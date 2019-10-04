const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const sassMiddleware = require('node-sass-middleware');
const layouts = require('ejs-layouts');
const mysql = require('mysql');
const createDebug = require('debug');
require('colors'); // eslint-disable-line import/no-unassigned-import

import * as express from 'express';

import { ResponseWithLayout } from './definitions';
import {render} from './render_helpers';
import {queries} from './query_helpers';
import {BaseModel} from './models/base';
import config from './config/config';
import {routes} from './config/routes';

const appLogger = createDebug('app:base');
const routesLogger = createDebug('app:routes');

const pool = mysql.createPool(config.database.connectionObject());
BaseModel.pool = pool;

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(layouts.express);

// Libraries setup: body parser (for POST request bodies), cookie parser, SCSS compilation, static files.
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(sassMiddleware({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public'),
    indentedSyntax: false,
    sourceMap: true,
    outputStyle: 'compressed'
}));
app.use(express.static(path.join(__dirname, 'public')));

// Request logging setup
app.use((req: express.Request, res: express.Response, next: Function) => {
    console.log('\n');
    appLogger(`${req.method} ${req.url} HTTP/${req.httpVersion} : ${res.statusCode}`);
    next();
});

// Routes
for (let [path, routerFactory] of Object.entries(routes)) {
    app.use(path, routerFactory(pool, routesLogger));
}

// Handle errors
app.use((req, res: ResponseWithLayout) => {
    if (res.statusCode === 500) {
        render(req, res, 'common/coded_err', {name: 'Server Error',
            description: 'The server encountered an internal error while serving your request.'},
        {pool});
    }
    else {
        render(req, res, 'common/coded_err', {name: 'Not Found', description: 'The page you requested could not be found.'},
        {pool});
    }
});

(async () => {
    await queries(pool, [[], []], "SET GLOBAL sql_mode = 'NO_ENGINE_SUBSTITUTION,ALLOW_INVALID_DATES';", "SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION,ALLOW_INVALID_DATES';");

    app.listen(config.port);
    appLogger(`Listening on ${config.port}.`['green']['bold']);
})();