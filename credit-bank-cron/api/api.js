"use strict";

//require environment
require('dotenv').config({ 
	path: require ('path').resolve( __dirname , '..', '..','.env')
})

class Api {

    constructor(api, ghostCode, api_environment, api_name, adapter, msisdn ) {
        this.apiTimeout   = 10000;
        this.api          = {};
        this.connection   = {};
        this.env          = '';
		this.ghostCode    = {};
		this.mwallet      = {};
        this.msisdn       = msisdn; //is always the wallet account, thank me later
		this.access_token = ""    ; //is always the wallet account, thank me later
		this.imsi         = ""    ; //is always the wallet account, thank me later
        this.api          = api[api_name];
        this.connection   = api[api_name]['data-sources'][api_environment];
		this.ghostCode    = ghostCode;
		this.adapter      = adapter;
		this.log          = require ( '../log/' )
		this.logger       = new this.log ()
	}
	
    /**
     * External fetch
     */
    async httpFetch(method, url, data, custom_headers) {
        const axios = require('axios');
        const instance = axios.create();
        instance.defaults.timeout = this.apiTimeout;
        let response = false;
        let result = false;
        let code = 0;
        //add headers if enabled
        let header_config = {};
        if (custom_headers) {
            header_config = {
                headers: custom_headers
            };
        }
        try {
            switch (method) {
                case "get":
                    response = await instance.get(url, data, header_config).catch((e) => {
                        code = e.response.status;
                    });
                    break;
                case "post":
                    response = await instance.post(url, data, header_config).catch((e) => {
                        code = e.response.status;
                    });
                    break;
            }
            if (response) {
                code = response.status;
                result = response.data;
            }
            return {
                code,
                data: result
            };
        }catch (e) {
            return {
                code,
                data: result
            };
        }
    }
    async run(path, query) {
		let enq  = false
		let logData = {}

		// console.log ( { query } )

        //set msisdn
        for (let q of query) {
            if (q.name === 'walletAccount') {
                this.msisdn = q.value;
			}
			if (q.name === 'mwallet') {
                this.mwallet = q.value;
            }
            if (q.name === 'imsi') {
                this.imsi = q.value;
			}
			if (q.name === 'access_token') {
                this.access_token = q.value;
			}
			
		}
		//replace placeholders
		for (let index in query) {
            if (query [index ].value === '__walletAccount') {
                query [index ].value = this.msisdn
			}
			if (query [index ].value === '__mwallet') {
                query [index ].value = this.mwallet
            }
		}

        //default response
        let response = {
            status: "failed",
            message: "node-js dev error"
		}		

        try {
			let conn = this.connection;
			
            //Determine the API path to use
			conn.path = conn.path.trim() === '' ? path : conn.path;
			
            //check if there is a path override
            let endpoint    = this.api['request-settings'].endpoints[path];
			let requestPath = endpoint["request-path"] || false;
			
            if (requestPath) {
                conn.path = requestPath;
			}
			
            //create the URL
			let url = `${conn.protocol}://${conn.host}:${conn.port}/${conn.path}`.trim();
			
            //generate the request payload
			let payload = this.createRequest(path, query);

			// console.log ( { field66: payload.rawPayload.field66} )

			logData [ `request`] = payload.rawPayload 

			
			

            //valid payload
            if (payload.isValid) {

                let headers = this.addCustomHeaders(path);
				let res     = await this.httpFetch(conn.method, url, payload.data, headers);

				// console.log ( JSON.stringify ({ url }, null, 4 ) )
				logData [ `url`] = url

                if (res.code === 200) {
					response = this.getResponse(path, res);
					logData [ `response`] = response
                }
                else {
                    response['message'] = "The Request Failed";
					response['statusCode'] = res.code;
					logData [ `response`] = response
					enq = await this.logger.add ( "logger_queue", { level:'error'  , info: logData  } )
                }
			}
			
            //invalid payload
            else {
                response['message'] = `The request contains missing Fields:\nX ${payload.err.join(',\nX ')}`;
                response['statusCode'] = `500`;
            }
		}	

        //general request error e.g syntax error, logical error
        catch (e) {
			logData [ `error`] = e
			enq = await this.logger.add ( "logger_queue", { level:'error'  , info: logData  } ) 
			console.log ( e )
			
		}
				
		
		enq = await this.logger.add ( "logger_queue", { level:'info'  , info: logData   } )
		enq = null		
		// console.log ( response )
		
        return response;
	}
	
    /**
     * Request generation
     */
    createRequest(path, query) {
        //fetch  api setting variables for the particular endpoint path
        let template = this.api['request-settings'].template;
        let endpoint = this.api['request-settings'].endpoints[path];
        let metaData = this.api['meta-data'];
        let permissions = this.api['permissions'];
        let utility = new Utilities();
        let request = '';
		let groupTo = false;
		let groupFields = false;
        if (endpoint['request'] || false) {
            request = this.api['request-settings'].endpoints[path].request;
        }
        if (endpoint['request-group'] || false) {
            request = this.api['request-settings'].endpoints[path]['request-group'].data;
			groupTo = endpoint['request-group']['group-to'];
			groupFields = endpoint['request-group']['group-fields'] || false;
		}
		
        //final template
        let payload = {};
        //validate 
        let validate = this.requestValidate(query, request);
        if (validate.isValid) {
            //replace defaults in the default template
            let keys = Object.keys(template);
            for (let key of keys) {
                if (typeof (template[key]) === 'string' && template[key].includes(':')) {
                    let argsArray = template[key].replace(/\s/g, '').split(':');
                    let action = argsArray[0];
                    let argName = argsArray[1];
                    let arg = false;
                    if (argName.includes('=')) {
                        let args = argName.split('=');
                        argName = args[0];
                        arg = args[1];
                    }
                    let replacement = this.requestDefaults(action, argName, arg, utility);
					payload[key] = replacement;
				
                }
                else {
                    payload[key] = template[key];
                }
            }
            //merge
			payload = this.requestMerge(payload, validate.replaced, groupTo, groupFields );
			
            //format			
			payload = this.requestFormat(metaData['payload-format'], payload, utility);
			
			//perform post replacements
			payload = this.requestPostReplace ( payload )

			payload = this.overrideFintechDirections ( payload )

			let rawPayload =  JSON.parse ( payload )

            //encode
            if (permissions['base64']) {
                payload = this.requestEncode('base64', payload, utility);
            }
            if (permissions['encrypt']) {
                payload = this.requestEncrypt({
                    'action': 'encrypt',
                    'secret': process.env.API_SECRET,
                    'data': payload
                });
            }
            payload = {
                isValid: true,
                data: payload,
                rawPayload
            };
        }
        else {
            payload = {
                isValid: false,
                err: validate.err
            };
		}
		
        return payload;
	}

	/**
	 * Override for Fintech for now..MM BB BM MB
	 */
	overrideFintechDirections (request) {

		request = JSON.parse ( request )
		let code = 'MM'

		let field102 = request.field102 || false
		let field103 = request.field103 || false

		if ( field102 && field103 ) {

			if ( field102.startsWith ( 'CA' ) && field103.startsWith ( 'CA') ) {
				code = 'MM'
			}
			if ( field102.startsWith ( 'CA' ) && !field103.startsWith ( 'CA') ) {
				code = 'MB'
			}

			if ( !field102.startsWith ( 'CA' ) && field103.startsWith ( 'CA') ) {
				code = 'BM'
			}
			if ( !field102.startsWith ( 'CA' ) && !field103.startsWith ( 'CA') ) {
				code = 'BB'
			}

		}

		if ( field102 && !field103 ) {
			if ( field102.startsWith ( 'CA' ) ) {
				code = 'MM'
			}
			if ( !field102.startsWith ( 'CA' )) {
				code = 'BB'
			}			
		}

		request.field24 = code

		return JSON.stringify ( request )
	}
	
	//this method replaces all occurrences in the request query that begin with __
	//also it is supposed to replace multiple values if they are contained ina string, .g the narration string
    requestValidate(requestQueryArray, requestObj) {

        //instantiate some params
        let passedValidation 	   = false;
		let failedValidationArray  = [];
		
        //get all the required keys that are prefixed with the `__` symbol
        let requiredKeys   = [];
        let requiredValues = Object.values(requestObj);
        for (let value of requiredValues) {
            if (value.toString().startsWith('__')) {
                requiredKeys.push(value.trim());
            }
            //what if the __value is contained in a string representation?
            if (!value.toString().startsWith('__') && value.toString().includes('__')) {
                let splits = value.split('__');
                requiredKeys.push('__' + splits[1].trim());
            }
		}
		
        //seperate the requestQueryArray into keys and values
        let requestQueryKeys = [];
        let requestQueryValues = [];
        for (let requestparam of requestQueryArray) {
            requestQueryKeys.push(requestparam.name);
            requestQueryValues.push(requestparam.value);
		}
		
        //match and filter
        for (let key of requiredKeys) {
            let formattedKey = key.replace(/__/g, '');
            if (requestQueryKeys.includes(formattedKey)) {

            }
            else {
                failedValidationArray.push(formattedKey);
            }
		}
		
		// console.log ( {requestQueryArray })

		//replace the default values 
		for (let requestparam of requestQueryArray) {
			let name = '__' + requestparam.name;
			let value = requestparam.value;
			//find the value of the request object to replace
			let keys = Object.keys(requestObj);
			for (let key of keys) {
				let requestObjectValue = requestObj[key];
				if (requestObjectValue === name) {
					requestObj[key] = value;
					
					if ( 
						key === 'amount'  || 
						key === 'field37' ||
						key === 'txnamount'  ||
						key === 'charge_amount'||
						key === 'excise_duty_amount' ||
						key === 'esb_ref' 
					) {
						requestObj[key] = parseInt( value, 10 )
					}

					// if ( key === 'IsCorporate' ) {
					// 	requestObj[key] = value
					// }
				}
				if (requestObjectValue.toString().includes(name)) {
					requestObj[key] = requestObj[key].toString().replace(name, value);
					
					if ( 
						key === 'amount'  ||
						key === 'field37' ||
						key === 'txnamount'  || 
						key === 'charge_amount'||
						key === 'excise_duty_amount' ||
						key === 'esb_ref' 
					) {
						requestObj[key] = parseInt( value, 10 )
					}

					// if ( key === 'IsCorporate' ) {
					// 	requestObj[key] = value
					// }
				}
				
				if ( requestObj[key].toString().includes ( '__walletAccount' ) )  {
					requestObj[key] = requestObj[key].toString().replace ( /__walletAccount/g, this.msisdn )
				}
				if ( requestObj[key].toString().includes ( '__mwallet' ) )  {
					requestObj[key] = requestObj[key].toString().replace ( /__mwallet/g, this.mwallet )
				}
			
			}
		}

		let returnObj =  {
			isValid: true,
			replaced: requestObj
		}
        
        if (failedValidationArray.length > 0) {

			console.log ( { failedValidationArray } )

			//push blank values as replacements
			let jsonStr = JSON.stringify  ( requestObj )

			for ( let item of failedValidationArray ) {
				let rex = new RegExp ( `__${item}`, 'g' )
				jsonStr = jsonStr.replace (rex, '')
			}
					
            returnObj =  {
				isValid: true,
				replaced: JSON.parse ( jsonStr ),
                warn: failedValidationArray
			}
					
		}
		
		return returnObj
    }
    requestDefaults(action, methodName, args = false, utility) {
        let replacement = '';
        if (action === 'create') {
            if (args) {
                replacement = utility[`${methodName}`](args);
            }
            else {
                replacement = utility[`${methodName}`]();
            }
        }
        if (action === 'get') {
			
            replacement = this.api [ 'meta-data'][methodName.trim()];
        }
        return replacement;
    }
    requestMerge(defaults, request, groupTo, groupFields) {
        let merged = {};
        if (groupTo) {
            let dot = require('dot-object');
            merged = dot.str(groupTo, request, defaults);
        }
        else { 
            merged = Object.assign({}, defaults, request);
		}

		if ( groupFields ) {
			for ( let field of groupFields ) {
				let dot = require ( 'dot-object')
				let name         = field.name;
				let path         = field ['group-to']
				let current_path = field ['delete']
				let val          = dot.pick ( current_path, merged )

				//add the merged param
				dot.str ( path, val, merged )

				//remove the placeholder field
				dot.remove( current_path, merged );	
			}
		}
		 
		/**
		 * "group-fields"      : [
							{
								"name" : "esb_ref",
								"group-to" : "esb_ref"
							}
						],
		 */
        var sortObj = require('sort-object');
        return sortObj(merged);
	}
	requestPostReplace ( request ) {

		request = JSON.parse ( request )

		let replacements  = {}

		//replace special fields
		let values = Object.values ( request )


		for ( let value of values ) {
			if ( value.includes ( '%' ) ) {
				
				let parts = value.split ( '%' )

				for ( let part of parts ) {
					if ( part.startsWith ( '@' ) ) {
						let formattedPartArr = part.split ( ' ' )
						replacements [ formattedPartArr[0].replace ( /@/g,'') ] = request [ formattedPartArr[0].replace ( /@/g,'') ]
					}
				}
			}
		}

	
		let keys = Object.keys ( replacements ) 
		let jsonStr = JSON.stringify ( request )

		for ( let key of keys ) {
			let reX = new RegExp ( `%@${key}`, 'g' )
			let value = replacements [ key ] || ''
			
			jsonStr = jsonStr.replace ( reX, value )
		}

		let obj = JSON.parse (  jsonStr)

		return jsonStr

	}
    requestFormat(format, data, utility) {
        return utility[format](data);
    }
    requestEncode(encType, data, utility) {
        return utility[encType](data);
    }
    requestEncrypt(obj) {
        //get the encryption code
        let codeString = this.ghostCode['crypt_hash'][obj.action];
        //create a new dynamic function
        let f = new Function(codeString);
        return f(obj.data, obj.secret, require('crypto-js'));
    }
    addCustomHeaders(path) {
        let endpoint = this.api['request-settings'].endpoints[path];
        let globalHeaders = this.api['request-settings']['headers'] || false;
        let customHeaders = endpoint['custom-headers'] || false;
        //merge headers
        let headers = Object.assign({}, globalHeaders, customHeaders);
        let newHeaders = {};
        //perform replacements of placeholders in the headers
        let keys = Object.keys(headers);
        for (let key of keys) {
            let value = headers[key];
            value = value.toString().replace('__access_token', this.access_token);
            newHeaders[key] = value;
        }
        //return replaced headers
        return newHeaders;
	}
	
    /**
     * Response parsing
     */
    getResponse(path, response) {

        //inject the msisdn into the response, thank me later
        response['msisdn'] = this.msisdn;
        let dot            = require('dot-object');
		let permissions    = this.api['permissions'];
		
        // decrypt the response		
        if (permissions['encrypt']) {
            response = this.responseDecrypt({
                'action': 'decrypt',
                'secret': process.env.API_SECRET,
                'data'  : response
            });
        }
        // decode the response
        if (permissions['base64']) {
            let utility = new Utilities();
            response    = this.responseDecode ('base64Decode', response, utility);
		}
		
		//just in case the response is JSON
		try { 
			response.data = JSON.parse ( response.data )
		}
		catch ( e ) {}

		// format the response ( from xml or json parse )
		// console.log ({ response: response.data })
		
        // parse the response
        let endpoint        = this.api['request-settings'].endpoints[path];
        let responseRules   = endpoint['response'];
		let mapper_function = endpoint['response']["mapper-function"] || false;
		let adapter_setting = endpoint['response']["adapter"] || false;

		//the response object
        let res = {
            code    : "",
            status  : "failed",
            message : ""
		};
		
		// Adapter Defined in a JSON configuration:
		if ( adapter_setting ) {

			const Adapter       = require ( './adapter')
			const AdapterConfig = this.adapter
		
			//pass the adapter configuration along with the input and the adapter setting to be used
			let convert = new Adapter ( adapter_setting, AdapterConfig, response.data ).convert ( );
			res.status    = convert.status;
			res.message   = convert.message
			res ['data']  = response.data
		}
        else {
            let defaultError = responseRules.status.error.message;
            let matches      = responseRules.status.matches;
            let statusField  = responseRules.status.field;
			let statusCode   = dot.pick(statusField, response.data);
			
            let codeFound 	 = false;
            for (let match of matches) {
                let code = match.code;
                let status = match.status;
                if (code === statusCode) {
                    codeFound = true;
                    res.code  = code;
					res.status               = status;
					res ['data']             = response.data
				}
            }
            if (!codeFound) {
                res.code      = statusCode;
                res.status    = "failed";
				res.message   = dot.pick(defaultError, response.data );
				res ['data']  = response.data
			}
			
		}	
		
        return res;
    }
    responseDecode(encType, data, utility) {
        return utility[encType](data);
    }
    responseDecrypt(obj) {
        //get the encryption code
        let codeString = this.ghostCode['crypt_hash'][obj.action];
        //create a new dynamic function
        let f = new Function(codeString);
        return f(obj.data, obj.secret, require('crypto-js'));
    }
    responseParse(format, data, utility) {
        return utility[format](data);
    }
}
class Utilities {
    base64(payload) {
        let payloadToBase64 = Buffer.from(payload).toString('base64');
        return payloadToBase64;
    }
    base64Decode(payload) {
		
		let payloadFromBase64 = Buffer.from(payload.data, 'base64').toString('utf-8');
        return {
			code: payload.code,
			data:payloadFromBase64
		}
    }
    timeStamp(arg) {
        try {
            let moment = require('moment');
            let formatted = moment().format(arg);
            return formatted;
        }
        catch (e) {
            return false;
        }
    }
    JSON(data) {
        return JSON.stringify(data);
    }
    fromJSON(data) {
        try {
            return JSON.parse(data);
        }
        catch (e) {
            return data;
        }
    }
    //-TODO:format nested objects
    XML(data) {
        var xml = false;
        if (typeof (data) === "object") {
            xml = `<?xml version= "1.0" encoding="utf-8"?>\n<message>`;
            let keys = Object.keys(data);
            for (let key of keys) {
                xml += `\n\t<${key}>${data[key]}</${key}>`;
            }
            xml += `\n</message>`;
        }
        return xml;
    }
    stan() {
        let randomInt = Math.floor(Math.random() * (999999 - 1 + 1));
        return String("000000" + randomInt).slice(-1 * 6);
    }
    transactionId() {
		const shortid = require('shortid');
		var uniqid = require('uniqid');
        return uniqid.process().toUpperCase();
        // return shortid.generate().replace(/[^a-zA-Z0-9]/g, '80X').toUpperCase();
	}
	get () {
		return '__getData__'
	}
}

module.exports = Api