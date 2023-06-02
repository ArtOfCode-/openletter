const aes = require('aes-js');

import {queries} from './query_helpers';
import * as et from 'express';
import * as mt from 'mysql';
import {User} from './models/user';
import config from './config/config';
import { BaseModel } from './models/base';
import { ResponseWithLayout } from './definitions';

// Calculating params here means slightly better performance later.
// const scryptParams: object = scrypt.paramsSync(0.5);

// Likewise, caching this means we don't have to fetch it every time.
let secretKeyBuffer: Buffer = null;

/**
 * Using config.secretKey, returns a cryptographically-secure byte buffer that can be used as a cryptographic key. Also
 * adds the generated key to the database so that it persists across restarts - which it needs to for things like
 * secure cookies.
 * @param pool a database connection pool
 * @returns {Promise} resolves get passed a byte buffer parameter; rejects get passed an error
 */
export const getSecretKey = async (pool: mt.Pool): Promise<Buffer> => {
  return new Promise<Buffer>(async (resolve, reject) => {
    if (secretKeyBuffer) {
      // Caaaaaaached. Which is good, because scrypt is allowed to take up to 500ms to calculate the key.
      resolve(secretKeyBuffer);
    }
    else {
      const data: any = await queries(pool, [[]], "SELECT * FROM metadata WHERE name = 'secret_key';");
      const {err, rows} = data[0];
      if (err) {
        reject(err);
      }
      else if (rows && rows.length > 0) {
        // We've got a copy in the database; turn that into a buffer and use it.
        const key = Buffer.from(rows[0].val, 'hex');
        secretKeyBuffer = key;
        resolve(key);
      }
      else {
        // No database copy - we actually have to calculate :(
        try {
          //const key; // = await scrypt.kdf(config.secretKey, scryptParams);
          //const insertData: any =
          //  await queries(pool, [], `INSERT INTO metadata (name, val) VALUES ('secret_key', '${key.toString('hex')}');`);
          // const {err: insertErr} = insertData;
          // if (insertErr) {
          //  reject(insertErr);
          //}
          //else {
            //secretKeyBuffer = key;
            //resolve(key);
          //}
        }
        catch (e) {
          reject(e);
        }
      }
    }
  });
};

/**
 * Create a secure one-way hash of a password that can be stored.
 * @param password the plaintext password to transform
 * @returns {Promise} resolves get passed a hex string; rejects get an error
 */
export const hashPassword = async (password: string): Promise<string> => {
  return new Promise<string>(async (resolve, reject) => {
    try {
      // Currently SHA-256 and PKCS HMAC - covers one-way hash and message authentication.
      //const hash = await scrypt.kdf(password, scryptParams);
      // resolve(hash.toString('hex'));
    }
    catch (err) {
      reject(err);
    }
  });
};

/**
 * Check a plaintext password against a pre-calculated hashed password.
 * @param hashed the pre-calculated password
 * @param plain the plaintext to compare
 * @returns {Promise} resolves get passed a boolean; rejects get an error
 */
export const verifyPassword = async (hashed: string, plain: string): Promise<string> => {
  return new Promise<string>(async (resolve, reject) => {
    try {
      // const result = await scrypt.verifyKdf(Buffer.from(hashed, 'hex'), plain);
      // resolve(result);
    }
    catch (err) {
      reject(err);
    }
  });
};

/**
 * Encrypt a plaintext string using AES-256-CTR and a given key.
 * @param plain the plaintext to encrypt
 * @param key a Buffer or array containing the key bytes - will be truncated to 32 bytes if longer
 * @returns {String} a hex ciphertext string
 */
export const encrypt = (plain: string, key: Buffer): string => {
  const bytes = aes.utils.utf8.toBytes(plain);
  const cryptor = new aes.ModeOfOperation.ctr(key.slice(0, 32)); // eslint-disable-line new-cap
  const cipher = cryptor.encrypt(bytes);
  return aes.utils.hex.fromBytes(cipher);
};

/**
 * Decrypt a ciphertext string from AES-256-CTR with a given key.
 * @param cipher the hex ciphertext to decrypt
 * @param key a Buffer or array containing the key. Same as encrypt.
 * @returns {String} a UTF-8 plaintext string
 */
export const decrypt = (cipher: string, key: Buffer): string => {
  const bytes = aes.utils.hex.toBytes(cipher);
  const cryptor = new aes.ModeOfOperation.ctr(key.slice(0, 32)); // eslint-disable-line new-cap
  const plain = cryptor.decrypt(bytes);
  return aes.utils.utf8.fromBytes(plain);
};

/**
 * Finds and decrypts the user cookie and loads the user details.
 * @param req the HTTP request object
 * @param pool a database connection pool
 * @returns {Promise} resolves get passed an object (containing user details) or null (if no user can be found) -
 *          doesn't reject, ever
 */
export const getUser = async (req: et.Request, pool: mt.Pool): Promise<User | null> => {
  /* User cookies are encrypted to prevent tampering. Technically there's probably still an attack vector here, since
   * we don't use a MAC variant of Rijndael, but the data stored in this app isn't particularly valuable. Could still
   * happen, but not really a concern to spend dev time on.
   *
   * (And no, I'm not using RSA encrypt/sign deliberately. It's slow.)
   */
  return new Promise<User>(async resolve => {
    if (req.cookies.checko_session) {
      const key = await getSecretKey(pool);
      const userData = JSON.parse(decrypt(req.cookies.checko_session, key));
      try {
        const users: Array<User> = await <Promise<Array<User>>>User.where({id: userData.user_id}).get();
        if (users.length <= 0) {
          resolve(null);
        }
        else {
          resolve(users[0]);
        }
      }
      catch (err) {
        resolve(null);
      }
    }
    else {
      resolve(null);
    }
  });
};

/**
 * Given a user ID, constructs and encrypts a user cookie that can be used by getUser.
 * @param res the HTTP response object
 * @param id the user ID to set
 * @param pool a database connection pool
 */
export const setUser = async (res: et.Response, id: number, pool: mt.Pool): Promise<void> => {
  const key = await getSecretKey(pool);
  const data = {user_id: id}; // eslint-disable-line camelcase
  const cookieData = encrypt(JSON.stringify(data), key);
  res.cookie('checko_session', cookieData, {maxAge: 2678400000, httpOnly: true});
};

/**
 * Use getUser to require a user to be logged in to use the current route.
 * @param req the HTTP request object
 * @param res the HTTP response object
 * @param pool a database connection pool
 * @returns null (redirects) if no user is logged in; else returns the user
 */
export const requireAuth = async (req: et.Request, res: et.Response, pool: mt.Pool): Promise<User | null> => {
  const user = await getUser(req, pool);
  if (!user) {
    res.redirect('/users/login');
    return null;
  }

  return user;
};

/**
 * Check if the user is authorized to perform an action, according to a supplied authorizer function, and only run the supplied action function if they are.
 * @param authorizer A function which, when called with a user argument, returns a boolean value indicating whether the user is authorized or not.
 * @param run The action function to run if the user is authorized.
 * @param req The Express request object for the current request.
 * @param res The Express response object for the current request.
 * @param next The Express-supplied next middleware-chaining function.
 * @param pool A MySQL Pool object for the current database connection.
 */
export const authOrNext = async (authorizer: Function, run: Function, {req, res, next, pool}: {req: et.Request, res: ResponseWithLayout, next: Function, pool: mt.Pool}): Promise<void> => {
    const user = await requireAuth(req, res, pool);
    if (authorizer(user)) {
        await run(user);
    }
    else {
        res.status(404);
        next();
    }
};
