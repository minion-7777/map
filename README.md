# Dandong Map

Offline map of companies in Dandong. Each company has a number, category, name, employee count, address, and map location. The browser keeps every company, and a service worker keeps the site and map images. Express and MySQL receive those companies when the server is reachable.

Coordinates are WGS84, the same system OpenStreetMap uses.

## Run it

MySQL 8 is required. Put the login in `server/.env` (a copy of `server/.env.example` is already there):

```
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=dandong_map
```

Then:

```powershell
npm install
npm run dev
```

Open http://localhost:3000. The API is http://localhost:4000. On first connection the server creates the `dandong_map` database and a `locations` table with number, category, company name, employee count, address, and location.

## Use it offline

```powershell
npm run build
npm start
```

The Dandong street map is stored in this project and loaded from this computer, so the map does not need an internet connection. Click **지도보관** once if you also want those images kept inside the browser.

Add, edit, delete, and search write to this browser first, then to local MySQL. That save does not need an internet connection. **Sync** sends anything still waiting. If two copies of a company both changed, the later edit wins.

Dragging a selected pin updates its location.


Then create the startup task:

Press Win+R, type taskschd.msc, and press Enter.
Choose Create Basic Task.
Name it Dandong Map.
Trigger: When I log on.
Action: Start a program.
Program: C:\nvm4w\nodejs\npm.cmd
Arguments: start
Start in: D:\00_Work\00_Projects\Map