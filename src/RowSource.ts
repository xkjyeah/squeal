import {Association, BelongsToAssociation, HasManyAssociation} from './Associations';
import * as Util from './Util';

export class RowSource {
  public name : string;
  public associations : { [otherName: string]: Association };
  public primaryKey : string | void;

  constructor(name: string | void = null, primaryKey : string | void = null) {
    this.associations = {};
    this.name = <string>name || Util.autogenerateName();
    this.primaryKey = primaryKey;
  }

  hasMany(that: RowSource, as?: string) {
    as = as || that.name;
    this.associations[as] = new HasManyAssociation(this, that);
  }

  belongsTo(that: RowSource, as?: string) {
    as = as || that.name;
    this.associations[as] = new BelongsToAssociation(that, this);
  }
}
