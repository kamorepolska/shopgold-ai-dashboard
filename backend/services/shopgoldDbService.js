'use strict';

const mysql = require('mysql2/promise');
const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

/* ── Settings helper — uses the same localDb as the rest of the app ── */
const { settingsOps } = require('../models/localDb');

/**
 * Gets Shopgold MySQL connection based on user settings (active instance)
 */
async function getConnection() {
  const host = settingsOps.get('mysql_host') || '';
  const port = parseInt(settingsOps.get('mysql_port')) || 3306;
  const user = settingsOps.get('mysql_user') || '';
  const password = settingsOps.get('mysql_pass') || '';
  const database = settingsOps.get('mysql_database') || '';

  if (!host || !user || !database) {
    throw new Error('Brak kompletnej konfiguracji MySQL w ustawieniach.');
  }

  return await mysql.createConnection({ host, port, user, password, database });
}

/**
 * Fetch categories from Shopgold database
 */
async function getShopgoldCategories() {
  const prefix = settingsOps.get('mysql_table_prefix') || 'sg_';
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.execute(`
      SELECT c.id_kategorii as id, c.parent_id, co.nazwa as name
      FROM ${prefix}kategorie c
      LEFT JOIN ${prefix}kategorie_opisy co ON c.id_kategorii = co.id_kategorii AND co.id_jezyka = 1
      ORDER BY c.parent_id ASC, c.kolejnosc ASC, co.nazwa ASC
    `);
    
    // Build tree logic
    const tree = [];
    const lookup = {};
    rows.forEach(r => {
      lookup[r.id] = { ...r, children: [] };
    });
    
    rows.forEach(r => {
      if (r.parent_id === 0 || !lookup[r.parent_id]) {
        tree.push(lookup[r.id]);
      } else {
        lookup[r.parent_id].children.push(lookup[r.id]);
      }
    });

    return tree;
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * Delete a category and optionally products or move products
 * @param {number} categoryId 
 * @param {string} action 'delete_products' | 'move'
 * @param {number|null} targetCategoryId 
 */
async function deleteCategory(categoryId, action, targetCategoryId = null) {
  const prefix = settingsOps.get('mysql_table_prefix') || 'sg_';
  let connection;
  let ftpClient;

  try {
    connection = await getConnection();
    await connection.beginTransaction();

    if (action === 'move') {
      if (!targetCategoryId) throw new Error('Brak kategorii docelowej do przeniesienia.');
      
      // Move products to target category
      await connection.execute(`
        UPDATE ${prefix}produkty_kategorie 
        SET id_kategorii = ? 
        WHERE id_kategorii = ?
      `, [targetCategoryId, categoryId]);

      // Remove duplicate relationships if any were created
      await connection.execute(`
        DELETE t1 FROM ${prefix}produkty_kategorie t1
        INNER JOIN ${prefix}produkty_kategorie t2 
        WHERE t1.id = t2.id AND t1.id_produktu = t2.id_produktu AND t1.id_kategorii = t2.id_kategorii AND t1.id > t2.id
      `);

    } else if (action === 'delete_products') {
      // Find products in this category
      const [prodRows] = await connection.execute(`
        SELECT id_produktu FROM ${prefix}produkty_kategorie WHERE id_kategorii = ?
      `, [categoryId]);
      
      const productIds = prodRows.map(r => r.id_produktu);

      if (productIds.length > 0) {
        // We only delete a product if it belongs ONLY to this category (or if we want to delete it anyway?).
        // The user says: "Jeśli produkt należy do usuniętej kategorii ORAZ do innych, opcja Usuń zachowa produkt... Jeśli to jego JEDYNA kategoria to skasuje"
        // Let's find products that ONLY have this category
        const [counts] = await connection.execute(`
          SELECT id_produktu, COUNT(*) as cat_count
          FROM ${prefix}produkty_kategorie
          WHERE id_produktu IN (${productIds.join(',')})
          GROUP BY id_produktu
        `);

        const toDeleteIds = [];
        counts.forEach(r => {
          if (r.cat_count === 1) toDeleteIds.push(r.id_produktu);
        });

        if (toDeleteIds.length > 0) {
          const idsList = toDeleteIds.join(',');

          // Need to delete photos via FTP if configured
          const ftpHost = settingsOps.get('ftp_host');
          if (ftpHost) {
            const [photos] = await connection.execute(`
              SELECT zdjecie FROM ${prefix}produkty_zdjecia WHERE id_produktu IN (${idsList})
              UNION
              SELECT zdjecie FROM ${prefix}produkty WHERE id_produktu IN (${idsList})
            `);

            const imagesToDelete = photos.map(r => r.zdjecie).filter(Boolean);

            if (imagesToDelete.length > 0) {
              const ftpUser = settingsOps.get('ftp_user');
              const ftpPass = settingsOps.get('ftp_pass');
              const ftpPort = parseInt(settingsOps.get('ftp_port')) || 21;
              const ftpPath = settingsOps.get('ftp_path') || '/public_html';

              ftpClient = new ftp.Client();
              await ftpClient.access({
                host: ftpHost,
                port: ftpPort,
                user: ftpUser,
                password: ftpPass,
                secure: false
              });

              for (const img of imagesToDelete) {
                try {
                  await ftpClient.remove(`${ftpPath}/foto/${img}`);
                } catch (e) {
                  console.warn('FTP remove error for', img, e.message);
                }
              }
            }
          }

          // Delete from database
          await connection.execute(`DELETE FROM ${prefix}produkty WHERE id_produktu IN (${idsList})`);
          await connection.execute(`DELETE FROM ${prefix}produkty_opisy WHERE id_produktu IN (${idsList})`);
          await connection.execute(`DELETE FROM ${prefix}produkty_zdjecia WHERE id_produktu IN (${idsList})`);
          await connection.execute(`DELETE FROM ${prefix}produkty_cechy WHERE id_produktu IN (${idsList})`);
          // Note: Add any other tables that need cascade delete
        }
      }

      // Finally, delete the link in produkty_kategorie
      await connection.execute(`
        DELETE FROM ${prefix}produkty_kategorie WHERE id_kategorii = ?
      `, [categoryId]);
    }

    // Finally delete the category itself
    await connection.execute(`DELETE FROM ${prefix}kategorie WHERE id_kategorii = ?`, [categoryId]);
    await connection.execute(`DELETE FROM ${prefix}kategorie_opisy WHERE id_kategorii = ?`, [categoryId]);

    await connection.commit();
    return { success: true };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) await connection.end();
    if (ftpClient && !ftpClient.closed) ftpClient.close();
  }
}

/**
 * Delete a single product from ShopGold (MySQL + FTP photos)
 * @param {number} shopId  - The product shop_id (id_produktu in ShopGold)
 */
async function deleteProductFromShop(shopId) {
  let connection;
  let ftpClient;
  try {
    connection = await getConnection();
    await connection.beginTransaction();
    const id = parseInt(shopId);
    if (!id) throw new Error('Nieprawidłowe shop_id: ' + shopId);

    // Detect table prefix — ShopGold databases vary: some use sg_ prefix (Polish), some have English names without prefix
    const [tableList] = await connection.query('SHOW TABLES');
    const tableNames = tableList.map(t => Object.values(t)[0]);
    let prefix = '';
    if (tableNames.includes('sg_produkty')) {
      prefix = 'sg_';
    }
    // Determine if this is Polish-style (sg_produkty) or English-style (products) schema
    const isPolish = tableNames.includes('sg_produkty') || tableNames.includes('produkty');
    const productTable    = isPolish ? `${prefix}produkty`           : 'products';
    const descTable       = isPolish ? `${prefix}produkty_opisy`     : 'products_description';
    const photosTable     = isPolish ? `${prefix}produkty_zdjecia`   : 'additional_images';
    const attrTable       = isPolish ? `${prefix}produkty_cechy`     : 'products_attributes';
    const catTable        = isPolish ? `${prefix}produkty_kategorie` : 'products_to_categories';
    const relTable        = isPolish ? `${prefix}produkty_powiazane` : 'products_related_products';
    const idField         = isPolish ? 'id_produktu'                 : 'products_id';
    const imageField      = isPolish ? 'zdjecie'                     : 'products_image';
    const relatedField    = isPolish ? 'id_powiazanego'              : 'products_id_related';

    // Remove FTP photos if FTP is configured
    const ftpHost = settingsOps.get('ftp_host');
    if (ftpHost) {
      const allImagePaths = [];

      // Collect additional images (popup_images column)
      if (tableNames.includes(photosTable)) {
        const imgCol = isPolish ? imageField : 'popup_images';
        const [photos] = await connection.execute(
          `SELECT ${imgCol} as img FROM ${photosTable} WHERE ${idField} = ?`, [id]
        );
        allImagePaths.push(...photos.map(r => r.img).filter(Boolean));
      }

      // Collect main product image (products_image column)
      if (tableNames.includes(productTable)) {
        const mainImgCol = isPolish ? imageField : 'products_image';
        const [mainImg] = await connection.execute(
          `SELECT ${mainImgCol} as img FROM ${productTable} WHERE ${idField} = ?`, [id]
        );
        if (mainImg[0]?.img) allImagePaths.push(mainImg[0].img);
      }

      if (allImagePaths.length > 0) {
        const ftpUser = settingsOps.get('ftp_user');
        const ftpPass = settingsOps.get('ftp_pass');
        const ftpPort = parseInt(settingsOps.get('ftp_port')) || 21;
        const ftpPath = settingsOps.get('ftp_path') || '/public_html';

        // Image size prefixes used by ShopGold
        const sizePrefixes = ['60px_', '100px_', '120px_', '150px_', '200px_', '250px_', '320px_', '400px_', '700px_', '1000px_', ''];

        ftpClient = new ftp.Client();
        await ftpClient.access({ host: ftpHost, port: ftpPort, user: ftpUser, password: ftpPass, secure: false });

        for (const imgPath of allImagePaths) {
          // imgPath example: "p/3/9/3/39368312.jpg"  or  "products/3013556/abc.jpg"
          const imgBasename = path.basename(imgPath); // e.g. "39368312.jpg" or "abc.jpg"
          const imgSubdir   = path.dirname(imgPath);  // e.g. "p/3/9/3" or "products/3013556"

          // 1. Try removing from main images dir with all size prefixes
          for (const prefix of sizePrefixes) {
            // In root /images/ folder  (e.g. /images/60px_39368312.jpg)
            try { await ftpClient.remove(`${ftpPath}/images/${prefix}${imgBasename}`); } catch (e) {}
            // In /images/mini/ folder
            try { await ftpClient.remove(`${ftpPath}/images/mini/${prefix}${imgBasename}`); } catch (e) {}
            // In the original subdir path (e.g. /images/p/3/9/3/39368312.jpg)
            try { await ftpClient.remove(`${ftpPath}/images/${imgSubdir}/${prefix}${imgBasename}`); } catch (e) {}
          }

          // 2. Legacy path: /public_html/foto/  (old ShopGold Polish-style)
          for (const prefix of sizePrefixes) {
            try { await ftpClient.remove(`${ftpPath}/foto/${prefix}${imgBasename}`); } catch (e) {}
          }

          // 3. Exact path as stored in DB under /images/
          try { await ftpClient.remove(`${ftpPath}/images/${imgPath}`); } catch (e) {}

          console.log(`[FTP] Usunięto zdjęcie: ${imgPath}`);
        }
      }
    }

    // Delete from all related tables (ignore errors for non-existent tables)
    const deletes = [
      [productTable, idField],
      [descTable, idField],
      [photosTable, idField],
      [catTable, idField],
    ];
    if (tableNames.includes(attrTable)) deletes.push([attrTable, idField]);
    for (const [tbl, col] of deletes) {
      if (tableNames.includes(tbl)) {
        try { await connection.execute(`DELETE FROM \`${tbl}\` WHERE \`${col}\` = ?`, [id]); } catch(e) { console.warn(`Delete from ${tbl}:`, e.message); }
      }
    }
    // Related products (two columns)
    if (tableNames.includes(relTable)) {
      try { await connection.execute(`DELETE FROM \`${relTable}\` WHERE \`${idField}\` = ? OR \`${relatedField}\` = ?`, [id, id]); } catch(e) {}
    }
    // Extra tables that might exist
    for (const extra of ['products_extra_fields', 'products_youtube', 'products_film', 'products_stock', 'products_file', 'products_link', 'products_notifications', 'products_allegro_info', 'products_price_history']) {
      if (tableNames.includes(extra)) {
        try { await connection.execute(`DELETE FROM \`${extra}\` WHERE products_id = ?`, [id]); } catch(e) {}
      }
    }

    await connection.commit();
    return { success: true };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) await connection.end();
    if (ftpClient && !ftpClient.closed) ftpClient.close();
  }
}

module.exports = {
  getShopgoldCategories,
  deleteCategory,
  deleteProductFromShop
};

