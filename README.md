# Nabil

Nabil is a responsive storefront prototype with Excel/CSV inventory import, SKU-matched product photos, product search, and a shopping bag.

## Open the storefront

Open `index.html` in a modern browser. The full 2,127-item catalog is bundled in `catalog.js`, so products appear without selecting an Excel file. Keep `index.html`, `catalog.js`, and `images/` together when copying Nabil to hosting. Search matches item names and SKUs; the catalog includes the repaired Arabic names.

Excel (`.xls` and `.xlsx`) import loads the SheetJS reader from a CDN and therefore needs an internet connection. CSV import is built in.

The importer reads the first worksheet and recognizes common column names. It requires:

| Store field | Example column names |
| --- | --- |
| Item code | `SKU`, `Item Code`, `Product Code`, `Item Number` |
| Product name | `Name`, `Product`, `Item`, `Title`, `Description` |
| Price | `Web Price` (preferred), `Price`, `Sale Price`, `Sales Price`, `Unit Price`, `Regular Price`, `Retail Price` |
| Photo URL | `Image URL`, `Photo URL`, `Picture URL`, `Image` |
| Category (optional) | `Category`, `Department`, `Type` |

QuickBooks POS inventory exports are supported: Nabil uses `sku` as the item code, `Item Name` as the product name, and prefers `Web Price` over `Regular Price`. It also repairs the legacy Windows-1256 Arabic text encoding used in this workbook during import/export.

### Importing separate product photos

1. Keep the product photos together in one folder.
2. Photos can be named with the matching item code (`290.jpg`) or the QuickBooks POS pattern (`290_Def.jpg`) for SKU `290`. JPG, PNG, WebP, GIF, and AVIF image files are accepted.
3. In **Manage products**, select the Excel workbook and then the photo folder.
4. Check the matched-photo count shown before importing, then import.

The photo filename must match the SKU (case-insensitive, without the file extension and optional `_Def` suffix). Duplicate or unmatched photo names are reported and skipped. Photos and products selected through this admin import are saved in the current browser using IndexedDB and local storage; they are not uploaded to a server. The 1,899 product photos found in the provided `Pictures\products\Item Pictures` folder are bundled separately in `images/` for the public catalog.

## Preparing products for Shopify

The supplied QuickBooks workbook has already been converted to [`nabil-shopify-products.csv`](./nabil-shopify-products.csv) in this project folder using the exact columns from Shopify's downloaded `product_template.csv`: it contains 2,127 product rows, repairs the source's legacy Windows-1256 Arabic encoding, uses `Web Price` with `Regular Price` as a fallback, maps `UPC` to `Barcode`, and imports all products as drafts. Existing URL handles are retained so a corrected re-import can update previously imported products instead of creating duplicates. No image URLs are included.

For later spreadsheet changes, Nabil can export the selected workbook again:

1. In **Manage products**, select the QuickBooks Excel workbook and the product photo folder.
2. To include photos in Shopify's CSV import, host the files inside this project’s `images/` folder at a public HTTPS URL, then select `images/` in **Manage products** and enter its public URL in **Public photo URL prefix**. For example, `images/290.jpg` hosted at `https://your-domain.com/images/290.jpg` uses `https://your-domain.com/images` as the prefix. A local file path is not a public URL.
3. Download the Shopify CSV and import it from **Shopify admin → Products → Import**. The exporter uses all columns from Shopify's current sample template. The checkbox is optional: by default products export as drafts so you can review them first. Check it only if prices, availability, images, shipping, and payment setup are ready.
4. Set up Shopify Payments or another supported payment provider, shipping, taxes, and inventory in Shopify before taking live orders. Importing the CSV does not itself configure these settings.

The exporter uses the `Web Price` field first, then `Regular Price`. It tracks inventory in Shopify, imports a quantity of `0`, and sets **Continue selling when out of stock** to `DENY`; this avoids publishing unsupported or accidentally overselling stock. Update quantities from verified QuickBooks stock counts in Shopify before activating products. The workbook has multiple quantity columns/locations, so Nabil does not guess which quantity should be imported. Shopify interprets numeric prices in the store's configured currency. See Shopify's [product CSV guide](https://help.shopify.com/en/manual/products/import-export/using-csv) and [sample template](https://help.shopify.com/csv/product_template.csv).

Prices are currently displayed in USD; change the `CURRENCY` value in `index.html` to the store's currency before use.

## Important: online publishing and payments

The bundled storefront can display and search all 2,127 catalog items after the site files are hosted. Customers can send a prepared order request to the shop owner on WhatsApp; they must review and send the message themselves. The order request includes selected items, SKUs, quantities, subtotal, customer name, and delivery address. Confirm availability, delivery, and the payment method with the customer before accepting payment. WhatsApp ordering does not charge cards or reserve stock.

The WhatsApp order link is configured for `+9613032792`; change `WHATSAPP_NUMBER` in `index.html` if you want to use a different shop number. You can host the static catalog on a free service such as GitHub Pages with a free `github.io` address. Keep `index.html`, `catalog.js`, `.nojekyll`, and the complete `images/` folder together when you upload the site. The Shopify product CSV is not needed for the website and is excluded from GitHub with `.gitignore`. A custom domain generally costs money. If you import the Shopify CSV into Shopify later, connect the domain through Shopify if you want their online checkout; a GitHub Pages site does not power Shopify checkout.

Products added through the browser importer are stored locally in that browser only; they are not shared with the hosted catalog. The bundled `catalog.js` is the storefront data source for the 2,127 products prepared from the provided workbook.

Product and image files on a GitHub Pages site are public, which is expected for a storefront. Do not put customer details, passwords, or payment secrets in the published files. Nabil does not take online card payments or store customer orders.

## Free publishing with GitHub Pages

1. Create a GitHub account if you do not already have one, then install the free GitHub Desktop app and sign in.
2. Create a **public** GitHub repository named `nabil` (product names, SKUs, prices, WhatsApp contact, and photos become public website files).
3. In GitHub Desktop, choose **File → Add local repository**, select this Nabil folder, then choose **Publish repository**. If asked, create a repository here first; publish it as public.
4. Publish the project, including `index.html`, `catalog.js`, `.nojekyll`, `README.md`, `.gitignore`, and every file in `images/`. The prepared image folder contains about 105 MB across 1,899 products. `nabil-shopify-products.csv` is intentionally excluded because the website does not need the admin import file.
5. In the GitHub repository, open **Settings → Pages**, choose **Deploy from a branch**, select the `main` branch and `/ (root)`, then save.
6. After deployment finishes, open the URL shown in the Pages settings on your phone. It will look like `https://YOUR-USERNAME.github.io/nabil/`.
7. Test product search, a photo, and the WhatsApp order button on your phone before sharing the address.

GitHub Pages is static hosting only: it does not accept card payments or update stock automatically. For custom-domain hosting, the domain registration is separate and usually costs money. For secure online card checkout and automatic order handling, use a commerce provider or add a backend and payment service later.
