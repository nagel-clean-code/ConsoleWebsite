const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const pty = require("node-pty");
const stripAnsi = require("strip-ansi");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on("connection", socket => {
  const shellCommand = process.platform === "win32"
    ? "powershell.exe"
    : (process.env.SHELL || "bash");

  const shell = pty.spawn(shellCommand, [], {
    name: "xterm-color",
    cols: 120,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env,
  });

  socket.emit("output_clean", `Подключено к локальной оболочке: ${shellCommand}\n`);

  socket.on("input", data => {
    if (data === "\r") data = "\n";
    try {
      shell.write(data);
    } catch (err) {
      socket.emit("output_clean", `Ошибка ввода: ${String(err)}\n`);
    }
  });

  shell.on("data", data => {
    socket.emit("output_raw", data);
    socket.emit("output_clean", stripAnsi.default(data)); // Используем stripAnsi.default
  });

  shell.on("exit", code => {
    socket.emit("output_clean", `\nПроцесс завершён с кодом ${code}\n`);
    if (socket.connected) socket.disconnect(true);
  });

  socket.on("disconnect", () => {
    try { shell.kill(); } catch {}
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});