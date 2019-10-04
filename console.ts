import * as repl from 'repl';
import * as mysql from 'mysql';

import * as queryHelpers from './query_helpers';
import * as renderHelpers from './render_helpers';
import * as viewHelpers from './view_helpers';
import config from './config/config';

import {BaseModel} from './models/base';
import {User} from './models/user';
import {Signatory} from './models/signatory';

(async () => {
    const pool = mysql.createPool(config.database.connectionObject());
    BaseModel.pool = pool;

    await queryHelpers.queries(pool, [[], []], "SET GLOBAL sql_mode = 'NO_ENGINE_SUBSTITUTION,ALLOW_INVALID_DATES';", "SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION,ALLOW_INVALID_DATES';");

    const re = repl.start('openletter> ');
    const context = {};
    Object.assign(context, queryHelpers, renderHelpers, viewHelpers, config);
    Object.assign(context, {BaseModel, User, Signatory});
    Object.assign(re.context, context);
})();