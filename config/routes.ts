import * as express from 'express';
import * as mysql from 'mysql';
import * as debug from 'debug';

import users from '../routes/users';
import dashboard from '../routes/dashboard';

export const routes: {[key: string]: Function} = {
    '/users': users,
    '/': dashboard
};