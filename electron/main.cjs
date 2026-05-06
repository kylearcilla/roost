const { app, BrowserWindow } = require('electron')
const path = require('node:path')

/** Set `ELECTRON_DEV=1` (see `npm run electron:dev`) or pass `--dev` when running unpackaged. */
const dev =
	process.env.ELECTRON_DEV === '1' ||
	(!app.isPackaged && process.argv.includes('--dev'))

function createWindow() {
	const win = new BrowserWindow({
		width: 1280,
		height: 840,
		minWidth: 720,
		minHeight: 480,
		show: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	})

	win.once('ready-to-show', () => win.show())

	if (dev) {
		const url = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
		void win.loadURL(url)
		win.webContents.openDevTools({ mode: 'detach' })
	} else {
		const indexHtml = path.join(__dirname, '..', 'build', 'index.html')
		void win.loadFile(indexHtml)
	}
}

app.whenReady().then(() => {
	createWindow()
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})
