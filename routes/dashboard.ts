import * as express from 'express';
import * as mt from 'mysql';
import {URLSearchParams} from 'url';
import {render, error} from '../render_helpers';
import config from '../config/config';
import {Signatory} from '../models/signatory';
import {ResponseWithLayout} from '../definitions';
import * as crypto from 'crypto';
const fetch = require('node-fetch');
const router = express.Router(); // eslint-disable-line new-cap

export default (pool: mt.Pool, log): express.Router => {
    router.get('/', async (req: express.Request, res: ResponseWithLayout) => {
        const signatories = await Signatory.where(`se_acct_id IS NOT NULL AND letter = 'main'`).order('is_moderator DESC, is_former_moderator DESC, RAND()', '', true).get();
        const etag = crypto.createHash('sha256').update(`${config.getSiteSetting('letterVersion')}-${signatories.length}`).digest('hex');
        res.setHeader('ETag', etag);
        render(req, res, 'dashboard/dash', {signatories}, {pool});
    });

    router.get('/lavender', async (req: express.Request, res: ResponseWithLayout) => {
        const signatories = await Signatory.where(`se_acct_id IS NOT NULL AND letter = 'lavender'`).order('is_moderator DESC, is_former_moderator DESC, RAND()', '', true).get();
        const etag = crypto.createHash('sha256').update(`${config.getSiteSetting('lavenderVersion')}-${signatories.length}`).digest('hex');
        res.setHeader('ETag', etag);
        render(req, res, 'dashboard/lavender', {signatories}, {pool});
    });

    router.get('/strike', async (req: express.Request, res: ResponseWithLayout) => {
        const signatories = await Signatory.where(`se_acct_id IS NOT NULL AND letter = 'strike'`).order('is_moderator DESC, is_former_moderator DESC, RAND()', '', true).get();
        const etag = crypto.createHash('sha256').update(`${config.getSiteSetting('strikeVersion')}-${signatories.length}`).digest('hex');
        res.setHeader('ETag', etag);
        render(req, res, 'dashboard/strike', {signatories}, {pool});
    });

    router.post('/sign', async (req: express.Request, res: ResponseWithLayout) => {
        const displayName = req.body['display_name'] || null;
        const letter = req.body['letter'] || 'main';
        if (displayName.indexOf('♦') !== -1) {
            error(req, res, 'You may not use the ♦ character in your display name.', pool);
            return;
        }
        const signatory: Signatory = await <Promise<Signatory>>Signatory.create({display_name: displayName, letter});
        res.redirect(`https://stackexchange.com/oauth?client_id=${config.getSiteSetting('clientId')}&scope=&state=${signatory.id}|${letter}&redirect_uri=${config.getSiteSetting('redirectUri')}`);
    });

    router.get('/auth-redirect', async (req: express.Request, res: ResponseWithLayout) => {
        console.log("start of route");
        const code = req.query['code'] as string;
        const state = req.query['state'] as string;
        const signatoryId = state.split('|')[0];
        const letter = state.split('|')[1];

        const params = new URLSearchParams();
        params.append('client_id', config.getSiteSetting('clientId'));
        params.append('client_secret', config.getSiteSetting('clientSecret'));
        params.append('code', code);
        params.append('redirect_uri', config.getSiteSetting('redirectUri'));

        const key = config.getSiteSetting('key');

        try {
            console.log("start of try");
            const resp = await fetch('https://stackexchange.com/oauth/access_token/json', {
                method: 'POST',
                body: params
            });
            const data = await resp.json();
            const accessToken = data.access_token;

            let page = 1, items = [], has_more = true;
            while (has_more) {
                const assocResp = await fetch(`https://api.stackexchange.com/2.2/me/associated?access_token=${accessToken}&filter=!*L3o9HqJx_y6B8td&page=${page}&key=${key}`);
                const assocData = await assocResp.json();
                console.log(assocData);
                items = items.concat(assocData.items);
                has_more = assocData.has_more;
                page++;
            }
            console.log("end of loop");
            
            const accountId = items[0].account_id;
            const isModerator = items.filter(i => i.user_type === 'moderator').length > 0;

            const signatory: Signatory = await <Promise<Signatory>>Signatory.find(Number.parseInt(signatoryId));
            const success = await signatory.update({se_acct_id: accountId, is_moderator: isModerator});

            if (success) {
                console.log("failure", letter);
                res.redirect(letter === 'main' ? '/' : `/${letter}`);
            }
            else {
                console.log("failure", letter);
                error(req, res, 'You have already signed this letter.', pool);
            }
        }
        catch (err) {
            console.error(err);
            error(req, res, 'Unknown server error. This problem has been logged.', pool);
        }
    });

    return router;
};
