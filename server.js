const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const pty = require('node-pty');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	httpCompression: true,
	maxHttpBufferSize: 1e7
});

// Serve static files (index.html, assets) from current directory
app.use(express.static(__dirname));

io.on('connection', socket => {
	const shellCommand = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
	const shell = pty.spawn(shellCommand, [], {
		name: 'xterm-color',
		cols: 120,
		rows: 30,
		cwd: process.env.HOME,
		env: process.env
	});

	socket.emit('output', `Подключено к локальной оболочке: ${shellCommand}\r\n`);

	socket.on('input', data => {
		try {
			const normalized = data === '\n' ? '\r' : data;
			shell.write(normalized);
		} catch (err) {
			socket.emit('output', `Ошибка ввода: ${String(err)}\r\n`);
		}
	});

	socket.on('resize', ({ cols, rows }) => {
		if (typeof cols === 'number' && typeof rows === 'number') {
			try { shell.resize(cols, rows); } catch {}
		}
	});

	shell.on('data', data => {
		socket.emit('output', data);
	});

	shell.on('exit', code => {
		socket.emit('output', `\r\nПроцесс завершён с кодом ${code}\r\n`);
		if (socket.connected) socket.disconnect(true);
	});

	socket.on('disconnect', () => {
		try { shell.kill(); } catch {}
	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	console.log(`Сервер запущен на порту ${PORT}`);
});


