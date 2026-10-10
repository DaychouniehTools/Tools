# Nabil

Nabil is a responsive product catalog with Arabic and English product names, SKU search, category filters, product photos, product details, a shopping bag, and WhatsApp order requests. The public storefront is hosted on GitHub Pages. Catalog imports are prepared locally on your computer.

## Website

Open `index.html` to view the bundled catalog. The prepared catalog has 2,127 items and 1,899 product photos in `images/`. Search matches names, item codes, categories, descriptions, and tags. Customers can click a product photo to see a larger image and its details.

## Import products locally

The importer does not use Supabase, Google sign-in, or a remote database. It reads the workbook in your browser and writes the updated catalog and matching photos to a local project folder you choose. Do not publish `admin-import.html`.

1. Open `admin-import.html` from the Nabil project folder in a recent version of Chrome or Edge.
2. Click **Choose Excel file** and choose your inventory workbook (`.xlsx`/`.xls`) or CSV file.
3. Optionally click **Choose photos folder** and select the folder with product photos. Photo filenames should match the item code, for example `290.jpg` or `290_Def.jpg`.
4. Click **Import Excel and photos**. When your browser asks, select the Nabil project folder containing `index.html`, `catalog.js`, and `images`. Matching products are updated by item code, products omitted from the workbook remain in the catalog, and matched photos are copied into `images/`.
5. Check the updated local storefront. To publish the changes online, publish the updated `catalog.js` and `images/` through GitHub Desktop.

The workbook's `Size` column is imported and shown on product cards and in product details. You can also add optional `Dimensions` and `Sizes` (or `Variants`) columns to show physical measurements separately from choices such as S/M/L. For example, `Dimensions` can contain `20 x 15 x 8 cm`, and `Sizes` can contain `Small, Medium, Large`. Search also matches these fields.

For the QuickBooks inventory export, the importer uses only the website fields: `Item Number` (item code), `Item Name`, `Web Price`, `Size`, `Department Name` (category), `Attribute`, `Item Description` (or `Brief Description` if the item description is empty), `UPC` (barcode), and `Web keywords`. Attributes appear in the storefront product details. Product images are matched from the selected photo folder by item code. Accounting, cost, reorder, and other back-office columns are ignored.

The browser fetches the Excel-reading library from jsDelivr when opening the importer for `.xls`/`.xlsx` workbooks; the spreadsheet and photos stay on your computer and are not sent to that service. CSV import uses the browser directly. Keep a backup of the project folder before importing.

The local importer is excluded from the public GitHub repository by `.gitignore`. If you move the project to another computer, copy `admin-import.html` there separately if you need the import tool.

## Catalog and orders

Prices are displayed in USD. WhatsApp order requests are sent to `+9613032791`; change `WHATSAPP_NUMBER` in `index.html` to change the shop contact. Customers review and send the prepared order themselves. The site does not process card payments or automatically reserve stock.

The public site, product names, prices, item codes, and photos are visible to visitors. The local importer can only modify files after you open it on your computer and grant access to the project folder; it is not an online admin login.

## GitHub Pages

Keep `index.html`, `catalog.js`, `.nojekyll`, and the complete `images/` folder in the public repository. GitHub Pages serves the storefront. Import products locally, then publish the updated catalog and photos using GitHub Desktop. Do not add `admin-import.html` to the public repository.
