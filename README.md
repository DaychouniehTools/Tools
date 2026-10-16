# Daychounieh Tools

Daychounieh Tools is a responsive product catalog with Arabic and English product names, SKU search, category filters, product photos, product details, a shopping bag, and WhatsApp order requests. The public storefront is hosted on GitHub Pages. Catalog imports are prepared locally on your computer.

## Start the project

Keep the storefront files (`index.html`, `catalog.js`, `.nojekyll`, and `images/`) at the repository root. The GitHub Pages workflow deploys that root, so moving the storefront into a subfolder would require changing the deployment workflow.

Use the GitHub repository folder in both Visual Studio Code and GitHub Desktop. The Desktop `Test` folder is a link to this repository folder:

1. In GitHub Desktop, open `Desktop\Test` (the folder containing `.git`).
2. In Visual Studio Code, open that same repository folder.
3. Keep the separate import-working copy at `Desktop\Daychounieh-Local-Project`. Choose it as the import source, then choose `Desktop\Test` as the GitHub repository destination. Never select the same folder for both.
4. Put local workbooks in `imports/workbooks/` and source product photos in `imports/photos/`.
5. Review copied changes in GitHub Desktop, then commit and push to publish through GitHub Pages.

The local-only `admin-import.html` importer is excluded from Git. For Excel/photo imports, double-click `Start Local Importer.bat` and open `http://127.0.0.1:8765/`. Use `Start POS Importer.bat` when you also need QuickBooks POS stock access. Alternatively, run the **Start local Excel importer** task from VS Code.

## Website

The current live shop is at `https://libanabil.github.io/C-Users-L_LT-Documents-Nabil/`. After the GitHub account and repository are renamed, the planned address is `https://daychouniehtools.github.io/Daychounieh-Tools/`. The published catalog currently has no products. The import-working copy may contain local, unpublished edits. When populated, search matches names, item codes, categories, descriptions, and tags, and customers can click a product photo to see a larger image and its details.

### Browse the shop offline

The published HTTPS storefront caches its page and catalog after you open it online once. When product photos are present, use **Save all product photos for offline use** in the catalog and leave the page open until it confirms completion. This uses device storage and internet data; use Wi-Fi and ensure the device has enough free browser storage. The browser may report photos that could not be saved; reconnect and retry if needed. Externally hosted images, web fonts, and WhatsApp links still require internet. Opening `index.html` directly from disk does not enable offline caching; use the published HTTPS site.

Generate and verify a new QR code after the GitHub Pages address changes. The homepage displays the shop contact number prominently; its number link starts a phone call, and the WhatsApp button opens a chat.

## Import products locally

The importer does not use Supabase, Google sign-in, or a remote database. It reads the workbook in your browser and writes the updated catalog and matching photos to a local project folder you choose. Do not publish `admin-import.html`.

### QuickBooks POS v9

On the Windows computer with QuickBooks POS installed, log in to POS and double-click `Start POS Importer.bat`. Keep `inventory-sync/pos_importer.py` with the launcher. The connector requires 32-bit Python and `pywin32`; if prompted, install the module with `py -3-32 -m pip install pywin32`. Keep the connector window open. In the local importer, read the POS items, then review and confirm the local catalog update. QuickBooks POS currently supplies item codes and stock quantities only: the connector does not read the POS picture tick or download POS pictures. Picture cleanup checks image URLs and files in the selected local project's `images/` folder. Changes are local until reviewed and published through GitHub Desktop; clicking Read does not update the live site.

1. Start the local importer with `Start Local Importer.bat` and open `http://127.0.0.1:8765/` in a recent version of Chrome or Edge. Use `Start POS Importer.bat` instead when you also need QuickBooks POS stock access.
2. Click **Select Excel file** and choose your inventory workbook (`.xlsx`/`.xls`) or CSV file. This only selects the workbook; it does not import it yet.
3. Optionally click **Choose photos folder** and select the folder with product photos. Name the main photo after its item code, such as `290.jpg` or `290_Def.jpg`. For an optional second photo, name it `290_2.jpg` or `290_Alt.jpg`; product details show both photos with previous/next controls. JPG, PNG, WebP, and GIF files are supported.
4. Click **Preview and import workbook**. The workbook replaces the local product list: only rows with positive numeric `Qty 1` and a non-empty `Item Name` are included. A blank name or the literal placeholder `empty` is skipped, and a previously listed product absent from the eligible workbook rows is removed. A completely blank workbook or one with only headers is allowed; after a clear confirmation, it removes every product from the local catalog while leaving photos in place. The previous local catalog is backed up under `imports/backups/`.
5. Check the updated local storefront. To transfer the inventory update to GitHub Desktop, choose the local project folder, then the separate repository folder containing `.git`, `index.html`, and `images`. Click **Copy catalog and photos to GitHub Desktop**. It copies `catalog.js` and referenced photos, does not delete extra images, and does not publish. Review the changes and commit and push them in GitHub Desktop to publish.

To remove all items without choosing a workbook, choose the local project folder and click **Delete all items**. Confirm the prompt; the old catalog is backed up and product image files are not deleted. This changes only the local catalog. To remove items from the live site too, copy the empty catalog to the repository and publish it with GitHub Desktop.

To remove every catalog item that has no usable local or web picture, click **Remove items without pictures** next to the import button. The tool checks all catalog items against existing files in the project's `images/` folder and valid web image URLs, shows a confirmation with the number to remove, and leaves all image files untouched. Back up the project before confirming; removing catalog items cannot be undone by the importer.

The workbook's `Size` column is imported and shown on product cards and in product details. You can also add optional `Dimensions` and `Sizes` (or `Variants`) columns to show physical measurements separately from choices such as S/M/L. For example, `Dimensions` can contain `20 x 15 x 8 cm`, and `Sizes` can contain `Small, Medium, Large`. Search also matches these fields.

Excel's `_x000D_` marker in text fields represents a carriage return/line break. The importer converts it to a normal line break instead of showing the marker in the product description.

For the QuickBooks inventory export, the importer uses only the website fields: `Item Number` (item code), `Item Name`, `Web Price`, `Qty 1` (availability filter), `Size`, `Department Name` (category), `Attribute`, `Item Description` (or `Brief Description` if the item description is empty), `UPC` (barcode), and `Web keywords`. `Qty 1` is required. The imported catalog is replaced with eligible workbook rows: products omitted from the workbook and rows whose quantity is zero, negative, blank, or nonnumeric are removed from the catalog; their photo files are not deleted. English field values are kept as entered in the workbook; the importer does not translate categories, colors, sizes, names, or descriptions. Optional Arabic columns are only used when they contain Arabic text supplied in the workbook. A blank cell clears the old value. Import stops rather than silently skipping rows with missing item codes or duplicate item codes. Product images are matched from the selected photo folder by item code. Accounting, cost, reorder, and other back-office columns are ignored.

The storefront displays the workbook's original English and any Arabic text contained in its fields; it automatically handles mixed text direction. The importer repairs common Arabic mojibake while leaving English words unchanged. Optional `Arabic Item Name`, `Arabic Description`, `Arabic Category`, `Arabic Size`, `Arabic Attribute`, and `Arabic Dimensions` columns can provide Arabic text, which is added only when explicitly supplied. Existing Arabic translations are not copied over workbook values.

The browser fetches the Excel-reading library from jsDelivr when opening the importer for `.xls`/`.xlsx` workbooks; the spreadsheet and photos stay on your computer and are not sent to that service. CSV import uses the browser directly. Keep a backup of the project folder before importing.

Arabic text in legacy `.xls` files is read using the Arabic Windows code page. CSV files are decoded as UTF-8 (including UTF-8/UTF-16 byte-order-mark files) or Arabic Windows-1256 when needed. The importer also repairs common Arabic text that was mistakenly decoded as Western Windows-1252. Check Arabic in the local preview before confirming; if it is still incorrect, stop and save the workbook as `.xlsx` or UTF-8 CSV.

Workbook text is used as written; a blank description clears the previous description unless a `Brief Description` or an explicit `Arabic Description` value is supplied. Review the local catalog before publishing.

The local importer is excluded from the public GitHub repository by `.gitignore`. If you move the project to another computer, copy `admin-import.html` there separately if you need the import tool.

## Catalog and orders

Prices are displayed in USD. WhatsApp order requests are sent to `+9613032791`; change `WHATSAPP_NUMBER` in `index.html` to change the shop contact. Customers review and send the prepared order themselves. The site does not process card payments or automatically reserve stock.

The public site, product names, prices, item codes, and photos are visible to visitors. The local importer can only modify files after you open it on your computer and grant access to the project folder; it is not an online admin login.

## GitHub Pages

Keep `index.html`, `catalog.js`, `.nojekyll`, and the complete `images/` folder in the public repository. GitHub Pages serves the storefront. Import products locally, then publish the updated catalog and photos using GitHub Desktop. Do not add `admin-import.html` to the public repository.
