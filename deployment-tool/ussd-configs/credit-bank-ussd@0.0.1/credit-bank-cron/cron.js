"use strict";
/**
 * Runs a given Cron job based on set rules
 *
 * @class Cron
 */
class Cron {
    /**
        *     *    *    *    *    *
        ┬    ┬    ┬    ┬    ┬    ┬
        │    │    │    │    │    │
        │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
        │    │    │    │    └───── month (1 - 12)
        │    │    │    └────────── day of month (1 - 31)
        │    │    └─────────────── hour (0 - 23)
        │    └──────────────────── minute (0 - 59)
        └───────────────────────── second (0 - 59, OPTIONAL)
     *
     * @memberof Cron
     */
    runSchedule() {

		console.log( '[CRON] Set to run every 5 minutes...')

		const schedule    = require('node-schedule');
		const DynamicData = require ( './' )

		//ss mm HH DD MM DDD
        let j = schedule.scheduleJob('*/5 * * * * *', async () => {				
			await new DynamicData().fetchAll ()			
        })
    }
}
let cron = new Cron();
cron.runSchedule();
