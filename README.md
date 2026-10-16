# CampusCart

A MERN proof of concept for a campus essentials shop. Students browse stationery, bags, lab supplies, and lifestyle products, place Cash on Delivery orders, and follow their status. A demo administrator manages the catalog and ships orders.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```powershell
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Express on port 3001.

For a production build:

```powershell
npm run build
npm start
```

Open http://localhost:3001.

## Configured local MongoDB

This checkout's ignored `.env` points to `mongodb://127.0.0.1:27017/campuscart`. MongoDB Community Server 8.0 is installed separately as the `MongoDB` Windows service, so the database can start automatically with Windows. CampusCart still needs `npm run dev` or `npm start` to launch the application.

To inspect the database in MongoDB Compass, connect to `mongodb://127.0.0.1:27017` and open `campuscart` → `products` or `orders`. Compass is optional and not required to run the app.

To copy existing local demo records into MongoDB without overwriting existing records:

```powershell
node server/migrate-local.js
```

To test the API against a real local MongoDB instance in an isolated, temporary database:

```powershell
$env:TEST_MONGODB = '1'
npm run test:api
Remove-Item Env:TEST_MONGODB
```

The test removes only its own uniquely named `campuscart_test_...` database and does not use the main `campuscart` database.

## Use MongoDB for the assessment

Copy `.env.example` to `.env`, set `MONGODB_URI=mongodb://127.0.0.1:27017/campuscart`, start your local MongoDB server, then restart the app. An Atlas connection string can also be used. The API seeds eight products if the products collection is empty. The footer identifies the active storage mode.

Without `MONGODB_URI`, the app uses `data/store.json` as a persistent local demonstration store. This is useful for a quick preview, but **demonstrate with MongoDB to satisfy the MongoDB rubric criterion**. The demo file and MongoDB are separate stores; changing modes does not migrate data.

## Scope and architecture

- React, React Router, and Context: catalog, product detail, cart, checkout, order history, and admin routes.
- Express: REST endpoints, input validation, centralized error responses, and serialized writes.
- Mongoose: Product and Order models. Orders snapshot product names and prices, preserving order history after a product changes or is deleted.
- Cart and the current browser's order IDs are saved in localStorage. Product/order records live in the server store.
- Checkout sends product IDs and quantities. The server looks up prices, aggregates duplicate lines, checks available stock, calculates delivery, decreases stock, and saves the order.
- Orders follow Placed → Shipped → Delivered. Delivery costs ₹49 below ₹499 and is free from ₹499.
- Product illustrations use CSS, so the catalog does not depend on remote product photographs. Google fonts have local sans-serif fallbacks.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Active storage and demo mode |
| GET | `/api/products` | All products |
| GET | `/api/products/:id` | Product details |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Edit product details, price, and stock |
| DELETE | `/api/products/:id` | Delete a product |
| GET | `/api/orders` | Orders for this open demo |
| POST | `/api/orders` | Validate and place an order |
| PATCH | `/api/orders/:id` | Advance an order status |

Product writes accept `name`, `description`, `category`, integer `price` in rupees, and integer `stock`. Order creation accepts `customer: {name, email, address}` and `items: [{productId, quantity}]`. Status updates accept `{status: "Shipped"}` or `{status: "Delivered"}`.

## Validation

```powershell
npm test
npm run test:api
npm run build
```

The pricing tests check server-authoritative prices, delivery thresholds, duplicate-line stock limits, missing products, and invalid quantities. API integration tests use an isolated temporary store and check product CRUD, invalid checkout, stock changes, order totals, and status transitions.

## Three-minute demonstration

1. Browse categories, search for a notebook, and open its detail page.
2. Add products, change quantities, and show the delivery threshold in the bag.
3. Submit sample delivery details using Cash on Delivery.
4. Open My orders, then Admin demo → Orders. Mark the order Shipped.
5. Return to My orders and show the updated status.
6. In Admin demo → Products, create a product, edit it, and delete it.
7. Explain React → fetch → Express route → validation → Mongoose → MongoDB → response → React state.

## Honest PoC limitations

Admin is deliberately open and labelled as a demo. There is no authentication, private customer order authorization, payment gateway, actual delivery, or email sending. All orders can be read from the demo API; use fictional customer details. My orders filters by IDs stored in the current browser, which is presentation behavior rather than access control.

Writes are serialized in a single Express process. MongoDB persistence updates product and order documents without multi-document transactions; this is not suitable for production or multiple server instances. A real store would require authentication, role enforcement, transactional stock updates, payment verification, and stronger operational controls.

## Rubric evidence

| Criterion | Evidence |
| --- | --- |
| Problem and scope | Campus shopping problem, student/admin users, bounded workflow above |
| React | Reusable Art, Field, Summary components; routing; Context; controlled filters/cart |
| Express | Product/order routes, validation, JSON middleware, error handling |
| MongoDB | Product/Order Mongoose schemas and catalog CRUD; enable MongoDB for evaluation |
| Integration | Persistent order creation, stock changes, admin status updates |
| Functionality | Browse → cart → checkout → order → shipment |
| Testing | Pricing tests, isolated API workflow checks, production build |
| Documentation | Setup, architecture, API, demo script, limitations |
| Viva | Explain server-side pricing, order snapshots, and data flow |
