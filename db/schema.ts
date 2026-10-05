import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('profiles',{owner:text('owner').primaryKey(),data:text('data').notNull()});
export const products=sqliteTable('products',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),description:text('description').notNull(),category:text('category').notNull(),price:integer('price').notNull(),stock:integer('stock').notNull(),active:integer('active').notNull().default(1)});
export const orders=sqliteTable('orders',{id:text('id').primaryKey(),buyer:text('buyer').notNull(),seller:text('seller').notNull(),product:text('product').notNull(),quantity:integer('quantity').notNull(),total:integer('total').notNull(),status:text('status').notNull(),delivery:text('delivery').notNull(),created:text('created').notNull(),nonce:text('nonce').notNull().unique()});
export const limits=sqliteTable('limits',{id:text('id').primaryKey(),count:integer('count').notNull()});
