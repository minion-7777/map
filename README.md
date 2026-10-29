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

Open http://localhost:4000 once while online. Click **Save map for offline**. After that, the page, the companies, and the saved map images still work with the network off.

Add, edit, delete, and search all write to this browser first. **Sync** sends them to MySQL. If two copies of a company both changed, the later edit wins.

Dragging a selected pin updates its location.
