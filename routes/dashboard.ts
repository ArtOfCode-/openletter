import * as express from 'express';
import * as mt from 'mysql';
import {URLSearchParams} from 'url';
import {render, error} from '../render_helpers';
import config from '../config/config';
import {Signatory} from '../models/signatory';
import {ResponseWithLayout} from '../definitions';
const fetch = require('node-fetch');
const router = express.Router(); // eslint-disable-line new-cap

export default (pool: mt.Pool, log): express.Router => {
    router.get('/', async (req: express.Request, res: ResponseWithLayout) => {
        const signatories = await Signatory.order('is_moderator DESC, RAND()', '', true).get();
        render(req, res, 'dashboard/dash', {signatories}, {pool});
    });

    router.post('/sign', async (req: express.Request, res: ResponseWithLayout) => {
        const displayName = req.body['display_name'] || null;
        const signatory: Signatory = await <Promise<Signatory>>Signatory.create({display_name: displayName});
        res.redirect(`https://stackoverflow.com/oauth?client_id=${config.getSiteSetting('clientId')}&scope=&state=${signatory.id}&redirect_uri=${config.getSiteSetting('redirectUri')}`);
    });

    router.get('/auth-redirect', async (req: express.Request, res: ResponseWithLayout) => {
        const code = req.query['code'];
        const state = req.query['state'];

        const params = new URLSearchParams();
        params.append('client_id', config.getSiteSetting('clientId'));
        params.append('client_secret', config.getSiteSetting('clientSecret'));
        params.append('code', code);
        params.append('redirect_uri', config.getSiteSetting('redirectUri'));

        const key = config.getSiteSetting('key');

        try {
            const resp = await fetch('https://stackoverflow.com/oauth/access_token/json', {
                method: 'POST',
                body: params
            });
            const data = await resp.json();
            const accessToken = data.access_token;

            let page = 1, items = [], has_more = true;
            while (has_more) {
                const assocResp = await fetch(`https://api.stackexchange.com/2.2/me/associated?key=${key}&access_token=${accessToken}&filter=!*L3o9HqJx_y6B8td&page=${page}`);
                const assocData = await assocResp.json();
                items = items.concat(assocData.items);
                has_more = assocData.has_more;
                page++;
            }
            
            const accountId = items[0].account_id;
            const isModerator = items.filter(i => i.user_type === 'moderator').length > 0;

            const signatory: Signatory = await <Promise<Signatory>>Signatory.find(state);
            const success = await signatory.update({se_acct_id: accountId, is_moderator: isModerator});

            if (success) {
                res.redirect('/');
            }
            else {
                error(req, res, 'You have already signed this letter.', pool);
            }
        }
        catch (err) {
            error(req, res, 'Unknown server error. This problem has been logged.', pool);
        }
    });

    return router;
};