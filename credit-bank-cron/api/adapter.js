class Adapter {
	constructor ( adapterName, adapter, input ) {
		this.dot         = require ( 'dot-object')
		this.sort        = require ( 'sort-object' )
		this.flat        = require ( 'flat' )
		this.deepmerge   = require ( 'deepmerge' )
		this.input       = input;
		this.adapterName = adapterName;
		this.config      = adapter [ adapterName ] || false
		this.DELIMETER   = '__'
		this.SPACE       = ' '
		this.utility     = require ( './adapter-utility' )
	}
	convert     () {
		if ( this.config ) {
			let statusField = this.config.response.status.field;
			let template    = this.getTemplate ( statusField )

			if ( template.status === 'failed' ) {
				return {
					status : "failed",
					message: "couldnt load profile"
				}
			}
			else {
				try{
					let addRules = this.applyRules ( template.data )
					let merged   = this.merge ( addRules)

					//add a string for all accounts
					let withSpecial = this.handleSpecial ( merged )
					return {
						status : 'success',
						message: merged
					}
				}
				catch ( e ) {
					console.log ( { ADAPTER_CONVERSION_ERROR: e } )
					return {
						status : "failed",
						message: "couldnt load profile"
					}					
				}
			}
		}
		else {
			return false;
		}
	}
	getTemplate ( statusField ) {
		let matches          = this.config.response.status.matches
		let rawStatus        = this.dot.pick ( statusField, this.input )
		let matchFound       = false
		let status           = 'success'
		let message          = false
		let template         = {}
		let errorStatusField = this.config.response.status.error.message;
		

		for ( let match of matches ) {
			let statusCode = match.code;
			status = match.status		

			if ( statusCode === rawStatus ) {
				matchFound = true;
				break;
			}
		}
		if ( !matchFound ) {
			status = 'failed'
			message =  this.dot.pick ( errorStatusField, this.input )
		}

		try {
			template = this.config.response.mappers [ status ]
		}
		catch ( e ) {
		}
		let data = {}

		try {
			data = this.dot.dot ( template) 
		}
		catch ( e ) {} 

		return { 
			status,
			data
		}
	}
	applyRules  ( template ) {

		let keys         = Object.keys ( template )
		let allValues    = []

		for ( let key of keys ) {

			let valueParts   = []
			let toBeReplaced = []
			let value        = template [ key ]

			if ( value.toString().includes ( this.DELIMETER ) ) {

				valueParts = value.split ( this.SPACE )

				for ( let part of valueParts ) {
					if ( part.toString().startsWith ( this.DELIMETER ) ) {
						toBeReplaced.push ( part )						
					}
				}

				allValues.push ( this.getValues ( toBeReplaced ) )
			}
		}
		let templateString = JSON.stringify ( template ) ;

		for ( let value of allValues ) {

			let replacement = value.value;
			let rxp = new RegExp ( value.name, 'g' );

			
			if ( typeof ( value.value ) !== 'string' ) {

				for ( let key of keys ) {
					
					let keyValue        = template [ key ]

					if ( keyValue === value.name ) {
						templateString = JSON.parse ( templateString )
						templateString [ key ] = value.value 
						templateString =JSON.stringify ( templateString )
					}
				} 
				
			}
			else {
				templateString = templateString.replace ( rxp, replacement  )
			}
			
		}
		return this.dot.object (JSON.parse (  templateString ) ) 
	}
	getValues   ( ruleIds ) {
		let rules       = this.config.response.rules;
		let matched     = true
		let resultArray = []
		let NOT_FOUND   = []
		let values      = {}

		for  ( let item of ruleIds )  {

			let result = { name : item, value : false }

			//search through our rules
			for ( let rule of rules ) {
				if ( rule.name === item ) {
					result.value = this.dot.pick ( rule.path.trim() , this.input )

					if ( result.value !== 'undefined' ) {
						matched = true					

						//matches
						if ( rule.matches ) {
							for ( let match of rule.matches ) {
								if ( match.code === result.value ) {
									result.value = match.status
								}
								else {
									result.value = rule.default
								}
							}
						}

						//transforms
						if (  rule [ "format-as" ] ) {
							result.value = this.utility.transform ( rule [ "format-as" ], result.value )
						}

						//validations
						if (  rule [ "validation" ] ) {
							let isValid = false;
							let validations = rule [ "validation"]
							for ( let v of validations ) {
								isValid = this.utility [ v.name ] (result.value )
							}

							if ( !isValid ) {
								result.value = rule.default
							}
						}


						//value parsers
						if ( rule [ 'item-delimiter' ] ) {
							let parsedArray = result.value.split (rule [ 'item-delimiter' ] )

							parsedArray = parsedArray.filter ( ( item ) => {
								return item && item !== ''
							})

							let map = rule.map 
							
							if ( parsedArray.length > 0 ) {
								result.value = []


								

								for ( let index in parsedArray ) {

									let obj = {}

									let itemValue = parsedArray [ index ] 

									for ( let mapItem of map ) {
										obj [ mapItem ] = itemValue
									}
									

									result.value.push ( obj )
								}
								
							}
							else {
								
								result.value = rule.default								
							}
						}
					}
					else {
						NOT_FOUND.push ( { name: item, value: rule.default } )
						matched = false
					}
				}				
			}
			
			resultArray.push ( result )
		}

		if ( matched ) {
			values =  resultArray [ 0 ]
		}
		else {
			values = NOT_FOUND [ 0 ]
		}

		return values 
	}
	merge       ( data ) {
		
		let template   = this.config [ 'template']

		let merged = this.deepmerge.all ([
			template,
			data
		])

		return this.sort ( merged )	
	}
	flatten     ( data ) {
		data          = this.flat.flatten ( data, {
			safe: true
		})
		let flattened = {}
		let keys      = Object.keys ( data )
		for ( let key of keys ) {
			let levels = key.split ( '.' )
			let newKey = levels [ levels.length - 1 ]

			flattened [ newKey ] = data [ key ]
		}

		flattened = this.sort ( flattened )

		return flattened
	}
	handleSpecial ( data ) {

		let special = this.config.response.special
		let toBeReplaced = Object.keys ( special ) [ 0 ]
		// "special" : {
		// 	"account-details.all-accounts": "msisdn+account-details.savings-accounts"
		// }

		let specialArray = special [ toBeReplaced ].split ( '+' )
		let final = []

		for ( let item of specialArray ) {
			let value = this.dot.pick ( item, data )

			if ( value instanceof Array ) {

				for ( let i of value ) {
					final.push ( i.label )
				}
				
			}
			else {
				final.push ( value )
			}
		}

		//convert final to a string
		let finalString = ''

		for ( let i of final ) {
			finalString +=`a/c - ${i}\n `
		}

		

		this.dot.str(toBeReplaced, finalString, data );

		return data;
	}
}

module.exports  = Adapter