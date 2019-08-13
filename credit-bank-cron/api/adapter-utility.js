"use strict";
let hasMultiple = () =>{
	return true
};
let isAmount 			= (Joi, min) => {
    let minInt = parseInt(min, 10);
    return ({
        isAmount: Joi.number().required().min(minInt)
    });
};
let isText 				= (data) => {
    let dataLength = data.length;
    //let regex         = /[^a-zA-Z]/g;
    let regex = /^[A-Za-z]+$/i;
    let newData = data.replace(regex, "");
    let newDataLength = newData.length;
    if (regex.test(data)) {
        return true;
    }
    else {
        return false;
    }
};
let isNumber 			= (joi) => {
    return ({
        isNumber: joi.number().required()
    });
};
let checkIfIsNumber 	= (data) => {
    //isNaN
    let dataLength = data.length;
    let regex = /[^0-9]/g;
    let newData = data.replace(regex, "");
    let newDataLength = newData.length;
    if (dataLength == newDataLength) {
        // if ( regex.test(data) ) {
        return true;
    }
    else {
        return false;
    }
};
let isEmail 			= (data) => {
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    let isEmail = re.test(data);
    if (data && !isEmail && data.toLowerCase() === 's') {
        return true;
    }
    else {
        return isEmail;
    }
};
let isCorrectPin 		= (input, env ) => {

	console.log ({ "validator message" :  "checking for the correct PIN" })

	//check if mode is internal authentication or external authentication
	let isInternalAuth = env.app_config [ "internal-authentication" ] 

	if ( isInternalAuth ) {

		//format the PIN according to the rules defined
		let oldPin = env.user_data ['account-details'].pin || false;

		//transform the entered pin

		let transform_function = env.prompt_data [ "transform-function" ] || false

		let codeString = env.app_code[transform_function];
		//create a new dynamic function
		let f = new Function(codeString);
		let newPin = f({ 
			data  	:	input,
			msisdn	:	env.user_data .msisdn,
			crypto	:	require ("crypto-js")
		});

		if ( oldPin === newPin ) {
			return true;
		}
		else { 
			return false;
		}
	}

	//else skip and return control to the external authenticator
	else {
		return true;
	}    
};
let isDate 				= (data) => {
    //format DD-MM-YYYY
    let wDashes = data.replace(/-/g, '');
    //total length is correct
    if (wDashes.length !== 8) {
        return false;
    }
    let splitData = data.split('-');
    //parts are the correct length
    if (splitData[0].length !== 2) {
        return false;
    }
    if (splitData[1].length !== 2) {
        return false;
    }
    if (splitData[2].length !== 4) {
        return false;
    }
    //contains only numbers
    if (!checkIfIsNumber(splitData[0])) {
        return false;
    }
    if (!checkIfIsNumber(splitData[1])) {
        return false;
    }
    if (!checkIfIsNumber(splitData[2])) {
        return false;
    }
    //is a valid date
    if (parseInt(splitData[0], 10) > 31) {
        return false;
    }
    if (parseInt(splitData[1], 10) > 12) {
        return false;
    }
    return true;
};
let checkPinStrength 	= (pinString) => {
    //invalid length
    if (pinString.length !== 4) {
        return { "valid": false, "msg": "invalid_pin_length" };
    }
    //Convert the PIN into an array
    let pin = [];
    for (let p = 0; p < pinString.length; p++) {
        pin.push(pinString.charAt(p));
    }
    //helper function to map only unique values
    let onlyUnique = (value, index, self) => {
        return self.indexOf(value) === index;
    };
    try {
        let numbers = '1,2,3,4,5,6,7,8,9,0';
        let numericArray = numbers.split(',');
        let totinvalid = pin.length;
        let unique = pin.filter(onlyUnique);
        //Ensures all digits are numbers
        for (let i = 0; i < totinvalid; i++) {
            if (numericArray.indexOf(pin[i]) == -1) {
                return { "valid": false, "msg": "alpha_characters_found" };
            }
        }
        //Ensures that the pin doesnt consist of a single character
        let uniquePin = pin.filter(onlyUnique);
        //Ensure no sequence passwords exist e.g 1234, 4321, 9876,6789
        let sequence = [];
        for (let x = 0; x < pin.length; x++) {
            let difference = pin[x] - pin[x + 1];
            sequence.push(difference);
        }
        let sequenceDetected = sequence.filter(onlyUnique);
        if (sequenceDetected.length == 1 && sequenceDetected[0].toString() === '1') {
            return { "valid": false, "msg": "easy_pin" };
        }
        if (sequenceDetected.length == 1 && sequenceDetected[0].toString() === '0') {
            return { "valid": false, "msg": "easy_pin" };
        }
        if (sequenceDetected.length == 1 && sequenceDetected[0].toString() === '-1') {
            return { "valid": false, "msg": "easy_pin" };
        }
        //ensure that no birthdays are entered
        let birthdays = [];
        let date = new Date();
        let year = date.getFullYear();
        let maxyear = parseInt(year) - 18;
        let minyear = parseInt(year) - 100;
        for (let t = minyear; t <= maxyear; t++) {
            birthdays.push(t);
        }
        if (birthdays.indexOf(parseInt(pinString)) != -1) {
            return { "valid": false, "msg": "birthday_found" };
        }
        return { "valid": true, "msg": "valid_pin" };
    }
    catch (e) {
    }
};
let isValidPin 			= (data) => {
    // if (checkPinStrength(data).valid) {
    //     return true;
    // }
    // else {
    //     return false;
	// }
	
	return true
};
let isStrongPin 		= (data) => {
    if (checkPinStrength(data).valid) {
        return true;
    }
    else {
        return false;
	}
	
	return true
};
let isEqualToLastEntry 	= (input, env, comparisonPath ) => {

	let dot = require ( "dot-object" )

	//check if mode is internal authentication or external authentication
	let isInternalAuth = env.app_config [ "internal-authentication" ] 

	if ( isInternalAuth ) {

		//format the PIN according to the rules defined
		let oldValue = dot.pick ( comparisonPath, env.user_data['global-request-details'] );

		//transform the entered pin
		let transform_function = env.prompt_data [ "transform-function" ] || false

		if ( transform_function ) {

			let codeString = env.app_code[transform_function];

			//create a new dynamic function
			let f = new Function(codeString);

			let newValue = f({ 
				data  	:	input,
				msisdn	:	env.user_data .msisdn,
				crypto	:	require ("crypto-js")
			});
	
			if ( oldValue === newValue ) {
				return true;
			}
			else { 
				return false;
			}
		}
		else {
			if ( oldValue === input ) {
				return true
			}
			else {
				return false
			}
		}
	}

	//else skip and return control to the external authenticator
	else {
		return true;
	}    
};
let transform = (id, value, extra ) => {
	let transformed = value;
	let CryptoJS    = require("crypto-js");
	switch (id) {
		case 'money':
			transformed = `${parseFloat(value).toFixed(2)}`;
			break;
		case 'integer':
			transformed = parseInt ( value, 10 )
		break;
		case 'capitalize':
			transformed = value.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase(); });
			break;
		case "pin-hash":
			transformed = CryptoJS.HmacSHA256(Buffer.from(value + this.user_data.msisdn).toString('base64'), "secret").toString(CryptoJS.enc.Hex);
			break;
		case "ukulima-pin-hash":
			let secret = "hksdjoisdhsd";
			let passwordHash = CryptoJS.HmacSHA256(value, secret);
			transformed = CryptoJS.enc.Base64.stringify(passwordHash);
			break;
		case "remove-white-space":
			transformed = value.trim().replace(/\s/g, '');
			break;
		case "to-number":
			transformed = value.trim().replace(/[^0-9]/g, '');
			break;
		case "moment-date-range":
			let periodFigure = '', periodMeasure = '';	
	
			if ( value && value.toLowerCase().includes ( 'day' ) ) {
				periodFigure = parseInt ( value, 10 );
				periodMeasure = 'days';
				
			}		
			if ( value && value.toLowerCase().includes ( 'week' ) ) {
				periodFigure = parseInt ( value, 10 );
				periodMeasure = 'weeks';
				
			}		
			if ( value && value.toLowerCase().includes ( 'month' ) ) {
				periodFigure = parseInt ( value, 10 );
				periodMeasure = 'months';
				
			}		
			if ( value && value.toLowerCase().includes ( 'year' ) ) {
				periodFigure = parseInt ( value, 10 );
				periodMeasure = 'years';
				
			}		
			
			let moment    = require ( 'moment' );
			let today     = moment () ;
			let selection = moment ().subtract ( periodFigure, periodMeasure  );
			let dateTo    = today.format ( extra );
			let dateFrom  = selection.format ( extra );

			return {
				dateTo,
				dateFrom,
				periodMeasure,
				periodFigure
			}
			break;
	}  
	return transformed;
}
module.exports = {
	hasMultiple,
	isAmount,
	isText,
	isNumber,
	isEmail,
	isCorrectPin,
	isDate,
	isValidPin,
	isStrongPin,
	isEqualToLastEntry,
	transform
};