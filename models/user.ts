import {BaseModel} from './base';

export class User extends BaseModel {
    id: number;
    username: string;

    static get tableName() {
        return 'users';
    }

    get tableName() {
        return 'users';
    }
}
