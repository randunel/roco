var ssh2 = require('ssh2');

module.exports = Connection;

function Connection(host, port) {
    var connection = this;

    connection.status = 'init';
    connection.queue = [];
    connection.ssh = new ssh2();

    connection.ssh.connect({
        host: host,
        port: port
    });
    connection.ssh.on('ready', function() {
        connection.shell(function(err, stream) {
            if (err) {
                throw err;
            }
            connection.status = 'ready';
            connection.runNext();
        });
    });
}

Connection.prototype.run = function(cmd, cb) {
    var connection = this;

    connection.queue.push({
        cmd: cmd,
        cb: cb
    });

    if (connection.status === 'ready') {
        connection.runNext();
    }
};

Connection.prototype.runNext = function() {
    var connection = this;

    var command = connection.queue.splice(0, 1)[0];
    if ('undefined' === typeof command) {
        return;
    }
    connection.status = 'busy';
    connection.exec(command.cmd, function(err, stream) {
        if (err) {
            command.cb(err);
            return;
        }
        bufferStream(stream, 'ascii', function(data) {
            command.cb(null, data);
            connection.status = 'ready';
            connection.runNext();
        });
    });
};

// from mscdex/ssh2
function bufferStream(stream, encoding, cb) {
    var buf;
    if (typeof encoding === 'function') {
        cb = encoding;
        encoding = undefined;
    }
    if (!encoding) {
        var nb = 0;
        stream.on('data', function(d) {
            if (nb === 0) {
                buf = [ d ];
            } else {
                buf.push(d);
            }
            nb += d.length;
        }).on((stream.writable ? 'close' : 'end'), function() {
            cb(nb ? Buffer.concat(buf, nb) : buf);
        });
    } else {
        stream.on('data', function(d) {
            if (!buf) {
                buf = d;
            } else {
                buf += d;
            }
        }).on((stream.writable ? 'close' : 'end'), function() {
            cb(buf);
        }).setEncoding(encoding);
    }
}

