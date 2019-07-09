
class BuildTools {

    constructor () {
		this.Clear       = require('clear');
		this.Figlet      = require('figlet');
        this.path         = require ( 'path');
        this.executable   = 'ussd-win-x64.exe';
        this.sexecutable  = 'ussd-win-secure-x64.exe';
        this.buildPath    = this.path.resolve ( __dirname, '..', '..', 'build')        
        this.basePath     = this.path.resolve ( __dirname,"ussd-configs")
        this.distPath     = this.path.resolve ( __dirname, "..", "..", "dist")
        this.homePath     = this.path.resolve ( __dirname, "..", "..")
        this.ussdCorePath = this.path.resolve ( __dirname, "..", "..", "dist","core")

        this.commands = {
            kill       : `TASKKILL /F /IM ${ this.executable } /T`,
            killSecure : `TASKKILL /F /IM ${ this.sexecutable } /T`,
            start      : `cd ${ this.buildPath } && ${ this.executable }`,
            build      : 'npm run build-win',
            buildSecure: 'npm run build-win-secure'
        }
    }
    
    /**
     *------------------------------

        Start, Stop && Build App

     *------------------------------
     */
    async refresh ( app ) {

        let chalk = require ( 'chalk' );
    
        console.log ( chalk.green ( "_______________________\n"  ) )
        console.log ( chalk.green ( " USSD Dev Tools v4"     ) )
        console.log ( chalk.green ( "_______________________\n") )
    
        try {       
    
            //upload to redis
            await this.uploadToRedis ( app )
    
            //kill and start
            await this.runCmd ( this.commands.kill,  `running: \`${ this.commands.kill  }\`` )
            await this.runCmd ( this.commands.start, `running: \`${ this.commands.start }\`` )                    
        }
    
        catch ( e ) {
            console.log ( e );
        }
    
        
        
    }

    async deployConfig ( app ) {

		let chalk = require ( 'chalk' );
		
		this.Clear()
        let ussdText =  (                            
            this.Figlet.textSync(
				`USSD`,
				`isometric3`
            )
		);

        console.log ( '\n\n',chalk.bold.white (ussdText) );
        console.log ( `\n\nEclectics International ltd. All rights reserved.`)
        console.log ( "+----------------------------------------------------+\n" )
		console.log ( chalk.green ( " USSD Dev Tools v4"     ) )
		console.log ( chalk.bold ( " [ Timestamp ]"     ) )
		console.log ( require ('moment')().format(" h:mm A : dddd DD MMM, Y"))
        console.log ( "\n+----------------------------------------------------+" )
    
        try {       
    
            //upload to redis
            await this.uploadToRedis ( app )
    
            //kill and start
            // await this.runCmd ( this.commands.kill,  `running: \`${ this.commands.kill  }\`` )
            // await this.runCmd ( this.commands.start, `running: \`${ this.commands.start }\`` )                    
        }
    
        catch ( e ) {
            console.log ( e );
        }
    
        
        
    }

    //kill the default ussd eexecutable
    async kill ( ) {

        let chalk = require ( 'chalk' );
    
        console.log ( chalk.green ( "_______________________\n"  ) )
        console.log ( chalk.green ( " USSD Dev Tools v4"     ) )
        console.log ( chalk.green ( "_______________________\n") )
    
        try {   
            //kill and start
            await this.runCmd ( this.commands.kill,  `running: \`${ this.commands.kill  }\`` )                   
        }
    
        catch ( e ) {
            console.log ( e );
        }
    
        
        
    }

    //build the default ussd executables
    async build ( app ) {

        let chalk = require ( 'chalk' );
    
        console.log ( chalk.green ( "_______________________\n"  ) )
        console.log ( chalk.green ( " USSD Dev Tools v4"     ) )
        console.log ( chalk.green ( "_______________________\n") )
    
        try {    
            //upload to redis
            // await this.uploadToRedis ( app )
    
            //kill and build
            await this.runCmd ( this.commands.kill,  `running: \`${ this.commands.kill  }\`` )
            await this.runCmd ( this.commands.build, `running: \`${ this.commands.build }\`` )                    
        }
    
        catch ( e ) {
            console.log ( e );
        }
    
        
        
    }

    //build the secure ussd executables
    async buildSecure ( app ) {

        let chalk = require ( 'chalk' );
    
        console.log ( chalk.green ( "_______________________\n"  ) )
        console.log ( chalk.green ( " USSD Dev Tools v4"     ) )
        console.log ( chalk.green ( "_______________________\n") )
    
        try {

            //copy
            this.copyDist( )

            //obfuscate
            this.obfuscate ()

            //kill and build
            await this.runCmd ( this.commands.killSecure,  `running: \`${ this.commands.killSecure  }\`` )
            await this.runCmd ( this.commands.buildSecure, `running: \`${ this.commands.buildSecure }\`` )

            var fs = require("fs-extra");
            fs.removeSync(this.homePath +'/dist-sec') 
        }
    
        catch ( e ) {
            console.log ( e );
        }
    
        
        
    }
    
    copyDist () {

        var source          = this.distPath
        var destination     = this.homePath + '/dist-sec'

        // include fs-extra package
        var fs = require("fs-extra");
         
        // copy source folder to destination
        try {
            fs.copySync(source, destination, { overwrite: true } );
            fs.removeSync(this.homePath +'/dist-sec/.vscode')
            fs.removeSync(this.homePath +'/dist-sec/www')            
        }
        catch ( e ) {
            console.log ( e.message )
        }
        
    }

    obfuscate ( ) {

        let find  = require ( 'find' );
        let files = find.fileSync (/\.js$/, this.homePath +'/dist-sec' )

        files.forEach (  async file => {

            console.log ( file )
            
            let cmd = `javascript-obfuscator "${file}" --output "${file}" --compact true --self-defending false`

            try {
                await this.runCmd ( cmd,  `running: \`${ cmd  }\`` )                   
            }        
            catch ( e ) {
                console.log ( e.message );
            }
        })       
        
    }    

    /**
     *------------------------------

        Process and Save Configs

     *------------------------------
     */
    async getPagesAndPrompts ( app_name ) {

        let pages   = {}
        let prompts = {}

        try {
            let rootPaths = {
                pages   : this.path.resolve ( this.basePath, app_name, 'ui','pages' ),
                prompts : this.path.resolve ( this.basePath, app_name, 'ui','prompts' )        
            }

            let keys          = Object.keys ( rootPaths )
            

            for ( let key of keys ) {
        
                let rootpath  = rootPaths [ key ]
                let pathArray = await this.getPaths ( rootpath )
                
        
                switch ( key ) {
                    case 'pages':
                        let pagesArray = pathArray.map ( ( path ) => {
        
                            let pathParts = path.split ( this.path.sep  );
                            let systemPath = path;
        
                            let content = require ( systemPath )
                            let pathKey = pathParts [ pathParts.length -1 ].replace ( '.json','') 
                            return {
                                [ `${pathKey}` ] : content
                            } 
                        });
        
                        for ( let page of pagesArray ) {
                            let key = Object.keys ( page ) [ 0 ]
                            pages [ key ] = page [ key ]
                        }
        
                    break;
        
                    case 'prompts':
                        let promptsArray = pathArray.map ( ( path ) => {
        
                            let pathParts = path.split ( this.path.sep );
                            let systemPath = path;
        
                            let content = require ( systemPath )
                            let pathKey = pathParts [ pathParts.length -1 ].replace ( '.json','') 
                            return {
                                [ `${pathKey}` ] : content
                            } 
                        });
        
                        for ( let prompt of promptsArray ) {
                            let key = Object.keys ( prompt ) [ 0 ]
                            if (key !== 'cache')
                                prompts [ key ] = prompt [ key ]
                        }            
                    break;
                }
                
            }

            return {
                pages,
                prompts
            }
        }

        catch ( e ) {
            console.log ( e )
        }
    }

    async getPromptsCache ( prompts ) {

        let prompts_cache = {}

        //create a prompts cache file
        let promptkeys = Object.keys ( prompts );

        for ( let promptkey of promptkeys ) {
    
            let value = prompts [ promptkey ]
    
            if ( typeof prompts_cache [ promptkey === 'undefined' ] ){
                prompts_cache [ promptkey ] = []
            }
    
            //check if its an array or an object
    
            //prompts
            if ( typeof value ==='object' && value instanceof Array ) {
                // console.log ( promptkey );
                for ( let val of value ) {
                    prompts_cache [ promptkey ].push ( val.name )
                }
                
            } else{
                prompts_cache [ promptkey ].push ( value.name )
            }
        }

        return {
            prompts_cache
        }

    }

    async patchLanguage ( app_name ) {

        

        let languageFile       = require ( this.path.resolve  ( this.basePath,app_name,'language','language.json' ) );
        let { pages, prompts } = await this.getPagesAndPrompts( app_name );
        let { prompts_cache }  = await this.getPromptsCache ( prompts );

        /**
            page:
                -key is name
                -get the name,
                -get the options.label ( if it includes label, add to the language file )
                -get the error
         */
        //process language file for pages
        let languageObj = {};
        let languages = [ 'english', 'swahili', 'french' ];
        let pageArray = Object.keys ( pages )

        for ( let page of pageArray ) {
            let name    = pages [ page ].name;
            let options = pages [ page ].options;
            let error   = pages [ page ].error;

            options = options.filter ( ( o ) => {
                if ( o.label.includes ( 'label') && o.enabled ) {
                    return o
                }
            });

            for ( let language of languages ) {
                if ( !languageObj [ name ]) {
                    languageObj [ name ] = {}
                }
                if ( !languageObj [ name ][language] ){
                    languageObj [ name ][language] = {}
                }
                
                languageObj [ name ] [ language ] [ name ] = '';
                languageObj [ name ] [ language ] [ error ] = '';

                for ( let option of options ){
                    languageObj [ name ] [ language ] [ option.label ] = ''; 
                }
            }


        }
        

        /** 
            prompts:
                -get the key from the cache 
                -get the name,
                -get error or errors
                -if "action": "transact",
                    get "external-fetch" | success, error
            prompt
         */
        let promptsArray = Object.keys ( prompts );
        let cacheKeys = Object.keys (prompts_cache )

        //get all prompts
        let allPrompts = [];

        for ( let prompt of promptsArray ) {
            if ( prompts [ prompt ] instanceof Array ) {

                allPrompts = [ ...allPrompts, ...prompts [ prompt ] ];
            }
            else {
                allPrompts.push ( prompts [ prompt ] )
            }
        }

        let allPromptsArray = Object.keys ( allPrompts );

        for ( let prompt of allPromptsArray ) {

            

            let name            = allPrompts [ prompt ].name;
            let errors          = allPrompts [ prompt ].errors || false;
            let error           = allPrompts [ prompt ].error || false;
            let languageKeyName = '';
            let action          = allPrompts [ prompt ].action || false;
            let externalFetch   = allPrompts [ prompt ] ['external-fetch' ] || false;

            //search to get the keyname
            for ( let cacheKey of cacheKeys ) {

                let values = prompts_cache [ cacheKey ];

                if ( values.indexOf ( name ) > -1 ){
                    languageKeyName = cacheKey;
                }

            }

            if ( languageKeyName.trim () !== '' ) {

                

                for ( let language of languages ) {

                    if ( !languageObj [ languageKeyName ]) {
                        languageObj [ languageKeyName ] = {}
                    }
                    if ( !languageObj [ 'global' ]) {
                        languageObj [ 'global' ] = {}
                    }
                    if ( !languageObj [ languageKeyName ][language] ){
                        languageObj [ languageKeyName ][language] = {}
                    }
                    if ( !languageObj [ 'global' ][language] ){
                        languageObj [ 'global' ][language] = {}
                    }

                    languageObj [ languageKeyName ] [ language ] [ name ] = '';
                    
                    if ( action ) {
                        if ( action === 'transact' && externalFetch ) {
                            languageObj ['global' ] [ language ] [ externalFetch.success ] = '';
                            languageObj ['global' ] [ language ] [ externalFetch.error] = '';
                        }
                    }
                    else {
                        if ( errors ) {
                            for ( let err of errors ) {
                                languageObj [ languageKeyName ] [ language ] [ err ] = '';
                            }
                        }
                        if ( error ) {                
                            languageObj [ languageKeyName ] [ language ] [ error] = '';
                        }
                    }

                }
            }
        }

        

        //patch with the existing language file
        let patched       = { ...languageObj, ...languageFile }
        let patchedToJson = JSON.stringify ( { ...languageObj, ...languageFile }, null, 4 )

        try {
            let fs = require ( 'fs' );
            fs.unlinkSync    ( this.path.resolve ( this.basePath ,app_name, 'language','language.json' ) );
            fs.writeFileSync ( this.path.resolve ( this.basePath ,app_name, 'language','language.json' ), patchedToJson, 'utf-8' );
            console.log ( `${require('chalk').yellow(` (+)`)} language patch:`,true )

            return patched;
        }

        catch ( e ) {
            console.log ( e )
        }



    }

    async getPaths ( path ) {
        return new Promise ( ( resolve, reject ) => {   
            let recursive = require("recursive-readdir");
    
            recursive ( path, ( err, files ) => {
                if ( err ) reject ( err )
                resolve ( files )
            })
    
        })
    }

    //upload configs to Redis
    async uploadToRedis ( app_name ) {

        let chalk = require ( 'chalk' );
        
        let { pages, prompts } = await this.getPagesAndPrompts ( app_name );
        let { prompts_cache  } = await this.getPromptsCache ( prompts )
    
        //save the app config to Redis
        let app_config =  { 
			code            : require (  this.path.resolve ( this.basePath, app_name, 'config','code.json') ) || '',
            config          : require (  this.path.resolve ( this.basePath, app_name, 'config','config.json') ),
            api             : require (  this.path.resolve ( this.basePath, app_name, 'api','api.json' ) ),
            language        : await this.patchLanguage( app_name ),
            pages,
            prompts, 
            prompts_cache
		}

		require ( 'fs' ).writeFileSync ( `${app_name}.json`, JSON.stringify ( app_config, null, 4 ),'utf-8')
		
		// console.log (JSON.stringify (app_config,null,4))
    
        let cache_id = `${app_name}:config`
        let saveKeys = Object.keys ( app_config ) 
    
        for ( let key of saveKeys ) {
            let response = await this.save ( `${cache_id}:${key}`, app_config [ key ] )
            console.log ( ` ${require('chalk').yellow(`(+)`)} save:${key} : ${ chalk.blue ( response ) }` )
        }
    
    
    }

    async save ( key, data ) {

		let response = '';

		try {
			let cache    = require( './cache/cache.js' );
			let store    = new cache();
			response = await store.put(key, data);
		}
		catch ( e ) {
		}
        
        return response;
    }   

    //Run a command in the terminal and pipe responses to the terminal
    async runCmd ( command, startMsg = ''  ) {

        return new Promise ( ( resolve, reject ) => {
            let cmd = require ( 'node-cmd' );
            let chalk = require ( 'chalk' );

            let runCmd = cmd.get ( command );
            let dataLine = '';

            console.log ( `[ ${ startMsg } ]` )
            
            
            //listen to the terminal output
            runCmd
            .stdout.on(
                'data',
                ( data ) => {
                    dataLine += data;
                    if ( dataLine [ dataLine.length - 1 ] == '\n') {
                        console.log( chalk.grey ( dataLine ) );
                    }
                }
            )

            runCmd.stdout.on (
                'end',
                ( data ) => {
                    console.log ( chalk.green ( '[ command executed ]' ) )
                    resolve ( true );
                }
            )

            runCmd.stderr.on (
                'data',
                ( data ) => {
                    console.log ( chalk.red ( data ) )
                    // reject ( false );
                }
            )
            
            
        });
    }
}

module.exports = BuildTools;
