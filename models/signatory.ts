import {BaseModel} from './base';

export class Signatory extends BaseModel {
    id: number;
    se_acct_id: number;
    display_name: string;
    created_at: string;
    updated_at: string;

    static get tableName() {
        return 'signatories';
    }

    get tableName() {
        return 'signatories';
    }
}
