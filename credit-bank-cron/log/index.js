const Queue = require ( 'bull' )

class Enqueue {
	constructor ( ){
		this.conn      = {		
			redis: {
				port: 6379, 
				host: '127.0.0.1', 
				password: ''
			}
		}
	}
	async add ( name, data ){
		let   q = new Queue ( name, this.conn )
		await q.add ( data )
		await q.close()
	}
}

module.exports = Enqueue