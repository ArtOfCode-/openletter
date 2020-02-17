import * as express from 'express';
import * as mt from 'mysql';
import {query, parameters} from '../query_helpers';
import {hashPassword, verifyPassword, getUser, setUser, authOrNext, requireAuth} from '../user_helpers';
import {render, error} from '../render_helpers';
import {User} from '../models/user';
import {ResponseWithLayout} from '../definitions';
const router = express.Router(); // eslint-disable-line new-cap

export default (pool: mt.Pool, log): express.Router => { // eslint-disable-line no-unused-vars
  router.get('/new', (req: express.Request, res: ResponseWithLayout) => {
    render(req, res, 'users/new', {errors: [], user: new User({})}, {pool});
  });

  router.post('/new', async (req: express.Request, res: ResponseWithLayout) => {
    const {errors, username, email, password}: any = parameters(req, {
      username: {
        required: true
      },
      email: {
        required: true
      },
      password: {
        required: true,
        length: 8,
        compare: 'password_confirm'
      }
    });

    if (errors.length > 0) {
      render(req, res, 'users/new', {errors, user: new User({username, email})}, {pool});
    }
    else {
      const hashed = await hashPassword(password);

      try {
        query(pool, [[]], 'BEGIN;');
        const user = new User({username, email, password: hashed});
        await user.save();
        await setUser(res, user['id'], pool);
        query(pool, [[]], 'COMMIT;');
        res.redirect('/');
      }
      catch (err) {
        query(pool, [[]], 'ROLLBACK;');
        error(req, res, err, pool);
      }
    }
  });

  router.get('/login', (req: express.Request, res: ResponseWithLayout) => {
    render(req, res, 'users/login', {errors: null}, {pool});
  });

  router.post('/login', async (req: express.Request, res: ResponseWithLayout) => {
    const {errors, email, password}: any = parameters(req, {
      email: {
        required: true
      },
      password: {
        required: true
      }
    });
    if (errors.length > 0) {
      render(req, res, 'users/login', {errors}, {pool});
    }
    else {
      try {
        const users = await User.where({email}, {limit: 1}).get();
        if (users.length <= 0) {
          render(req, res, 'users/login', {errors: ['The username or password you entered was incorrect.']}, {pool});
        }
        else {
          const user = users[0];
          const passwordValid = await verifyPassword(user['password'], password);
          if (passwordValid) {
            await setUser(res, user['id'], pool);
            res.redirect('/');
          }
          else {
            render(req, res, 'users/login', {errors: ['The username or password you entered was incorrect.']}, {pool});
          }
        }
      }
      catch (err) {
        error(req, res, err, pool);
      }
    }
  });

  router.post('/logout', (req: express.Request, res: ResponseWithLayout) => {
    res.clearCookie('checko_session');
    res.redirect('/');
  });

  router.get('/me', async (req: express.Request, res: ResponseWithLayout) => {
    const user: User = await <Promise<User>>requireAuth(req, res, pool);
    if (user) {
      render(req, res, 'users/me', {}, {pool});     
    }
    else {
      res.redirect('/users/login');
    }
  });

  router.get('/:userId/edit', async (req: express.Request, res: ResponseWithLayout, next: Function) => {
    const targetUser = await User.find(parseInt(req.params['userId'], 10));
    await authOrNext((user: User) => user['id'].toString() === req.params['userId'].toString(), (user: User) => {
      render(req, res, 'users/edit', {errors: [], user: targetUser}, {pool});
    }, {req, res, next, pool});
  });

  router.post('/:userId/edit', async (req: express.Request, res: ResponseWithLayout, next: Function) => {
    const targetUser: User = await <Promise<User>>User.find(parseInt(req.params['userId'], 10));
    await authOrNext((user: User) => user['id'].toString() === req.params['userId'].toString(), async (currentUser: User) => {
      const {errors, username, email, password, first_name, last_name, phone, current_password}: any = parameters(req, {
        username: { required: true },
        email: { required: true },
        password: { required: false, length: 8, compare: 'password_confirm' },
        first_name: { required: true },
        last_name: { required: true },
        phone: { required: false },
        current_password: { required: true }
      });
  
      if (errors.length > 0) {
        render(req, res, 'users/edit', {errors, user: targetUser}, {pool});
      }
      else {
        const isVerified = await verifyPassword(targetUser['password'], current_password);

        if (!isVerified) {
          render(req, res, 'users/edit', {errors: ['current password is incorrect'], user: targetUser}, {pool});
          return;
        }

        const attribs = {username, email, first_name, last_name, phone};
        if (!!password) {
          attribs['password'] = await hashPassword(password);
        }
  
        try {
          query(pool, [[]], 'BEGIN;');
          await targetUser.update(attribs);
          query(pool, [[]], 'COMMIT;');
          res.redirect('/');
        }
        catch (err) {
          query(pool, [[]], 'ROLLBACK;');
          error(req, res, err, pool);
        }
      }
    }, {req, res, next, pool});
  });

  return router;
};
