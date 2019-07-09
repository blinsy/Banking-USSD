/**
 * @class DynamicData
 * 	Dynamic Data performs the following:
		- runs an API request to fetch banks, branches and schools
		- formats the data
		- Saves the data to the config section of Redis
 */
class DynamicData {
	constructor () {
		console.log( 'starting the dynamic data cron...' )
		this.globalConstants = {}
		this.apiNamespace    = "cbplc-cron-api"		
		this.api_config      = require ( "./config/api" )
		this.adapter_config  = require ( "./config/adapter" )
		this.code            = {}
		this.dataSource      = "development",
		this.client_id       = "254729347882" 
		this.queryParams     = [{ name: 'walletAccount', value: this.client_id  }]
		this.routes          = this.api_config [ this.apiNamespace ]["request-settings"]["endpoints"]
		this.Api = require ( "./api/api")
		this.apiHandler      = new this.Api(
			this.api_config,	 // api configuration settings: JSON
			this.code, 			 // custom code: JSON
			this.dataSource ,    // data source 
			this.apiNamespace,   // api namespace
			this.adapter_config, // adapter configuraation settigns: JSON
			this.client_id       // client ID
		)
		this.cacheKey        = "credit-bank-ussd@0.0.1:config:config"
		this.deepmerge       = require ( 'deepmerge')
	}
	async fetchAll () {

		let fetchIsSuccessful = false

		//fetch and transform data to conform with USSD v4
		for ( let route of Object.keys ( this.routes  ) ) {
			if ( route !== 'branch' ){
				
				const dJSON   = require('dirty-json')			
				let apiResult = await this.apiHandler.run( route, this.queryParams)

				// console.log( { apiResult, route } )
				
				if ( apiResult.status === 'success' ) {

					fetchIsSuccessful = true 
	
					let data = apiResult.data.Result || apiResult.data || false

					// console.log ( { data } )
	
					try {
						data = dJSON.parse(data)
					}
					catch ( e ) {}
	
					data = this.transform ( route, data )
	
					this.globalConstants  = { ...this.globalConstants , ...data[1] }
					
				}
				else {
					fetchIsSuccessful = false
					break;
				}
			}
		}

		//update the config
		if ( fetchIsSuccessful ){
			let config = await this.fetch ()

			//sanitize the global constants
			let oldConstants = config ['global-constants']
			let keys 		 = Object.keys ( this.globalConstants  )
			for ( let key of keys ) {
				try {
					delete oldConstants [ key ]
				}
				catch ( e ) {
					console.log ( e )
				}
			}
	
			let constants = this.deepmerge.all ([ oldConstants, this.globalConstants ])
			config [ 'global-constants' ] = constants
	
			// save the config
			let save = await this.save ( config )
			console.log ( { save } )
		}
		else {
			console.log ( 'fetch was not successful! :-( ')
		}

	}
	async fetchBranches ( data){
		console.log( 'fetching branches...')
		const dJSON   = require('dirty-json')

		for ( let item of data ) {
			let branchCode = item.value
			let query      = [ this.queryParams[0],{ name: 'branchCode', value: branchCode }]
			
			let apiResult  = await this.apiHandler.run( 'branch', query )
			
			if ( apiResult.status === 'success' ) {
				let data = apiResult.data.Result || false
				try {
					data = dJSON.parse(data)
				}
				catch ( e ) {}
				// console.log( { bank: item.label, code:item.value, branches: data } )
			}
		}
	}
	transform ( route, data ) {

		let duplicatesCheck = []
		let transformed     = []
		
		switch ( route ) {
			case "school":
				for ( let school of data ) {

					let schoolStr = JSON.stringify ( school )

					if ( !duplicatesCheck.includes ( schoolStr ) ) {
						duplicatesCheck.push ( schoolStr )
						transformed.push ({
							label: this.capitalize ( this.shorten (school.SchoolName) ),
							value: school.SchoolAccount
						})
					}
					
				}
				transformed = [ false, { 'school-options': transformed }]
			break;

			case "pesalink":
				for ( let bank of data ) {

					let bankStr = JSON.stringify ( bank )

					if ( !duplicatesCheck.includes ( bankStr ) ) {
						duplicatesCheck.push ( bankStr )
						transformed.push ({
							label: this.capitalize ( this.shorten ( bank.BankName ) ),
							value: bank.BankSortCode
						})
					}					
				}
				transformed = [ false,this.createBankLetters ( route, transformed )]
			break;

			case "so":
				for ( let bank of data ) {

					let bankStr = JSON.stringify ( bank )

					if ( !duplicatesCheck.includes ( bankStr ) ) {
						duplicatesCheck.push ( bankStr )
						transformed.push ({
							label: this.capitalize ( this.shorten ( bank.BankName ) ),
							value: bank.BankSortCode
						})
					}					
				}
				transformed = [ false,this.createBankLetters ( route, transformed )]
			break;

			case "rtgs":
				for ( let bank of data ) {

					let bankStr = JSON.stringify ( bank )

					if ( !duplicatesCheck.includes ( bankStr ) ) {
						duplicatesCheck.push ( bankStr )
						transformed.push ({
							label: this.capitalize ( this.shorten (bank.BankName) ),
							value: bank.BankCode
						})
					}
				}
				transformed = [ transformed,this.createBankLetters ( route, transformed )]	
			break;

			case "eft":
				for ( let bank of data ) {

					let bankStr = JSON.stringify ( bank )

					if ( !duplicatesCheck.includes ( bankStr ) ) {
						duplicatesCheck.push ( bankStr )
						transformed.push ({
							label: this.capitalize ( this.shorten (bank.BankName) ),
							value: bank.BankCode
						})
					}
				}
				transformed = [ false,this.createBankLetters ( route, transformed )]	
			break;


			case "account-opening":

				let products = [];
				let branches = [];

				try{
					const dJSON   = require('dirty-json')
					products = dJSON.parse ( data.Products )
					branches = dJSON.parse ( data.Branches )
					products = products.map ( ( product ) => {
						return {
							label: product.ProductName.toLowerCase(),
							value: product.ProductCode,
							meta : [
								{
									"display-name":"account-opening-product-name",
									"value" : product.ProductName.toLowerCase(),
									"cache-path" :"global-request-details"
								}
							]
						}
					})
					branches = branches.map ( ( branch ) => {
						return {
							label: branch.BranchName.toLowerCase(),
							value: branch.BranchCode,
							meta : [
								{
									"display-name":"account-opening-branch-name",
									"value" : branch.BranchName.toLowerCase(),
									"cache-path" :"global-request-details"
								}
							]
						}
					})
				}
				catch ( e ) {}
				transformed = [ false, { 'account-opening-branches': branches }]
			break;
		}

		return transformed
	}
	createBankLetters ( tranferType, banks ) {	
		let sortObj = require('sort-object');	
		let bankSettings = {}
		try {			
			let bankGroupings 	= {
				'ab'        : [
					{
						"keyName" : `${tranferType}-bank-letters`,
						"value"   : {
							"label"  : "A-B",
							"jump-to": `${tranferType}-a-b-bank-account`
						},
						"include" : false
					},
					{
						"keyName" : `${tranferType}-a-b-bank-accounts`,
						"include" : false,
						"value"   : []
					}
				],
				'c'         : [
					{
						"keyName" : `${tranferType}-bank-letters`,
						"value"   : {
							"label"  : "C",
							"jump-to": `${tranferType}-c-bank-account`
						},
						"include" : false
					},
					{
						"keyName" : `${tranferType}-c-bank-accounts`,
						"include" : false,
						"value"   : []
					}
				],
				'de'        : [
					{
						"keyName" : `${tranferType}-bank-letters`,
						"value"   : {
							"label"  : "D-E",
							"jump-to": 	`${tranferType}-d-e-bank-account`
						},
						"include" : false
					},
					{
						"keyName" : `${tranferType}-d-e-bank-accounts`,
						"include" : false,
						"value"   : []
					}
				],
				'f'         : [
					{
						"keyName" : `${tranferType}-bank-letters`,
						"value"   : {
							"label"  : "F",
							"jump-to": `${tranferType}-f-bank-account`
						},
						"include" : false
					},
					{
						"keyName" : `${tranferType}-f-bank-accounts`,
						"include" : false,
						"value"   : []
					}
				],
				'gh'        : [
					{
						"keyName" : `${tranferType}-bank-letters`,
						"value"   : {
							"label"  : "G-H",
							"jump-to": `${tranferType}-g-h-bank-account`
						},
						"include" : false
					},
					{
						"keyName" : `${tranferType}-g-h-bank-accounts`,
						"include" : false,
						"value"   : []
					}
				],
				'ijklm'     : [
					{
						"keyName" : `${tranferType}-bank-letters`,
						"value"   : {
							"label"  : "I-M",
							"jump-to": `${tranferType}-i-m-bank-account`
						},
						"include" : false
					},
					{
						"keyName" : `${tranferType}-i-m-bank-accounts`,
						"include" : false,
						"value"   : []
					}
				],
				'nopqrs'    : [
					{
						"keyName" : `${tranferType}-bank-letters`,
						"value"   : {
							"label"  : "N-S",
							"jump-to": `${tranferType}-n-s-bank-account`
						},
						"include" : false
					},
					{
						"keyName" : `${tranferType}-n-s-bank-accounts`,
						"include" : false,
						"value"   : []
					}
				],
				'tuvwzyz'   : [
					{
						"keyName" : `${tranferType}-bank-letters`,
						"value"   : {
							"label"  : "T-Z",
							"jump-to": `${tranferType}-t-z-bank-account`
						},
						"include" : false
					},
					{
						"keyName" : `${tranferType}-t-z-bank-accounts`,
						"include" : false,
						"value"   : []
					}
				]
			}
			let bgroupKeys 		= Object.keys ( bankGroupings )

			//get bank collections
			for ( let bank of banks ) {
				//let us search for the bank
				let bankletter = bank.label.charAt (0).toLowerCase()

				for ( let key of bgroupKeys ) {
					if ( key.includes ( bankletter ) ) {
						bankGroupings [ key ][0].include = true
						bankGroupings [ key ][1].include = true
						bankGroupings [ key ][1].value.push(bank)
					}
				}

			}

			//merge bank letters to a consumable format
			for ( let key of bgroupKeys ) {
				//process key by key
				let keyValue = bankGroupings [ key ]
				bankSettings [ keyValue [0]['keyName']] = []
			}

			for ( let key of bgroupKeys ) {
				//process key by key
				let keyValue = bankGroupings [ key ]
				
				//check if to include the letter
				if ( keyValue [0].include) {
					bankSettings [ keyValue [0]['keyName']].push (keyValue [0]['value'])
				}
			}

			//merge banks to a consumable format
			for ( let key of bgroupKeys ) {
				//process key by key
				let keyValue = bankGroupings [ key ]

				//check if to include the values
				if ( keyValue [1].include) {
					bankSettings [ keyValue [1]['keyName']] = []
					bankSettings [ keyValue [1]['keyName']] = keyValue [1]['value']
				}
			}
		}
		catch ( e ) {
			console.log ( e )
		}
		return bankSettings		
	}
	capitalize ( data ) {
		return data.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
	}
	shorten ( data ) {
		return data.split ( ' ', 3 ).join(' ').trim()
	}
	async fetch () {
        let cache = require('./cache/cache');
        let store = new cache();
        let result = await store.get(this.cacheKey);
        return result;
	}
	async save ( data ) {
		// save the Global Constants using a deep merge
		let cache = require('./cache/cache');
        let store = new cache();
        let response = await store.put(this.cacheKey, data);
        return response;
	}
}

( async function run() {
	await new DynamicData().fetchAll ()
}())

module.exports = DynamicData