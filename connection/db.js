const { Pool} = require('pg')

  const db=  new Pool({
    user: 'myuser',
    host: 'localhost',
    database: 'mydb',
    password: 'mypass',
    port: 5432,
  })

  async function postgress(query){
  const client = await db.connect();
  const result = await client.query(query);
  return result.rows;
  }

  module.exports = {postgress,db};