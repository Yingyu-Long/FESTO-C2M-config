# FESTO MSE6-C2M / FB36

A React and TypeScript application with a Node.js Modbus TCP backend for the Festo MSE6-C2M energy-saving module and CPX-FB36 bus node.

Monitor flow, outlet pressure, air consumption and estimated cost. Control automatic/manual mode, the shutoff valve and consumption reset, and configure pressure and standby parameters. The interface supports English and Chinese and saves connection settings and parameter drafts in the browser.

## Development

Requires Node.js 24 and npm. In the project directory:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. This starts both the frontend and backend. To run them separately, use `npm run server:dev` and `npm run dev:ui` in separate terminals. Stop an existing instance before starting another.

## Device configuration

The backend computer must reach the FB36 over Modbus TCP. The backend automatically loads `server/fb36.config.local.json`. For a new installation:

```sh
cp -n server/fb36.config.example.json server/fb36.config.local.json
```

The example maps module 0 (C2M) and module 1 (FB36):

| Setting | Address |
| --- | --- |
| `inputBase` | 45392 |
| `outputBase` | 40001 |
| `outputEchoBase` | 45399 |
| `diagnosticInput` | 45403 |
| `diagnosticOutput` | 40004 |

These are direct PDU addresses; do not subtract 40001 or 1. Confirm the layout against the device's built-in **Modbus/TCP** page and match the configured units. Set `mappingConfirmed: true` to enable reads and `writesEnabled: true` to enable controls. The existing local configuration already contains the confirmed mapping. Restart the backend after editing configuration.

Enter the device IP, port (normally 502) and Unit ID on the **Device connection** page. Read device parameters before applying changes, and use manual mode when editing them. Connecting does not automatically operate the valve or change parameters.

## Deployment

```sh
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Node.js serves the built frontend and API; keep it running on a computer with device-network access.

`FB36_CONFIG` overrides the local configuration path. The server listens on localhost; remote access requires an authenticated reverse proxy and `UI_ORIGIN` set to its browser-facing origin.
