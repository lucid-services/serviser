var _         = require('lodash');
var async     = require('async');
var Promise   = require('bluebird');

var ServiceError = require('../error/serviceError.js');
var sequelize    = require('../database/sequelize.js').Sequelize;

var cache = null;
var sequelizePenetrated = false;

/*
 * penetrateCacheSupport
 *
 * @param {object} seq - sequelize instance
 * @return void
 */
module.exports.penetrateCacheSupport = function(seq) {

    if (sequelizePenetrated === true) {
        return;
    }
    sequelizePenetrated = true;

    cache = require('./cache');
    seq.options.define.instanceMethods.refreshCache = cache.refreshInstanceCache;
    seq.options.define.instanceMethods.destroyCache = cache.destroyInstanceCache;
    seq.options.define.classMethods.refreshCache = cache.refreshCache;
    seq.options.define.classMethods.buildFromCache = cache.buildFromCache(sequelize); // Temporary disabled cache penetration

    var classMethods    = seq.Model.prototype;
    var instanceMethods = seq.Instance.prototype;
    var belongsTo       = seq.Association.BelongsTo.prototype;
    var belongsToMany   = seq.Association.BelongsToMany.prototype;
    var hasOne          = seq.Association.HasOne.prototype;
    var hasMany         = seq.Association.HasMany.prototype;

    var orgFindAll = classMethods.findAll;

    classMethods.findAll    = cache.findAll(orgFindAll, seq);
    classMethods.update     = cache.update(classMethods.update);
    classMethods.destroy    = cache.destroyMulti(classMethods.destroy, orgFindAll);

    instanceMethods.destroy = cache.destroy(instanceMethods.destroy);
    instanceMethods.save    = cache.save(instanceMethods.save);

    belongsTo.injectGetter     = cache.belongsTo.injectGetter(belongsTo.injectGetter);
    belongsToMany.injectGetter = cache.belongsToMany.injectGetter(belongsToMany.injectGetter);
    belongsToMany.injectSetter = cache.belongsToMany.injectSetter(belongsToMany.injectSetter);
    hasOne.injectGetter        = cache.hasOne.injectGetter(hasOne.injectGetter);
    //TODO not currently supported
    //belongsTo.injectSetter     = cache.belongsTo.injectSetter(belongsTo.injectSetter);
    //hasOne.injectSetter        = cache.hasOne.injectSetter(hasOne.injectSetter);

    hasMany.get   = cache.hasMany.get(hasMany.get);
    hasMany.has   = cache.hasMany.has(hasMany.has);
    hasMany.count = cache.hasMany.count(hasMany.count);
    hasMany.set   = cache.hasMany.set(hasMany.set);
    hasMany.add   = cache.hasMany.add(hasMany.add);
    hasMany.remove= cache.hasMany.remove(hasMany.remove);
};

/*
 *
 */
module.exports.instanceMethods = {
    addToJson            : addToJson,
    normalize            : normalize,
    checkAssocIfIncluded : checkAssocIfIncluded
};

/*
 *
 */
module.exports.classMethods = {
    search                   : search,
    createAssociationList    : createAssociationList,
    getAssociationArray      : getAssociationArray,
    getAsAttributeForInclude : getAsAttributeForInclude,
};


/*
 * addToJson
 *
 * overrides object's toJSON method and adds passed data under supplied key
 * if "runToJson" flag is set to true, runs "toJSON" method on data before it's attached to object.
 *
 * @param string key
 * @param mixin value
 * @param boolean runToJson
 * @return void
 */
function addToJson(key, value, runToJson) {
    var toJson = this.toJSON;
    this.toJSON = function() {
        var out = toJson.apply(this);

        if (runToJson) {
            if (Array.isArray) {
                var items = [];
                value.forEach(function(val) {
                    items.push(val.toJSON());
                });

                out[key] = items;
            } else {
                out[key] = value.toJSON();
            }
        } else {
            out[key] = value;
        }
        return out;
    }

}

/*
 * createAssociationList
 *
 * assignes "asoociationList" property to model class.
 * It creates our variation of already existing "associations" list
 *
 * @return void
 */
function createAssociationList() {
    this.associationList = this.associationList || {};
    for (var index in this.associations) {
        var ass = this.associations[index];
        var name = _.upperFirst(_.camelCase(ass.target.name));
        this.associationList[name] = ass;
    }
}

/*
 * checkAssocIfIncluded
 *
 * checks if all associations are already included - loaded in object
 *
 * @param array includeArray - array of associations for include in query
 *                            as given eg.: in findAll method as options.include option
 *
 * return boolean
 */
function checkAssocIfIncluded(includeArray) {

    return checkIncluded(this, includeArray);

    //recursive fn
    function checkIncluded(obj, assocForInclude) {
        for (var i = 0, len = assocForInclude.length; i < len; i++) {
            var inc = assocForInclude[i];
            if (obj instanceof Array) {
                obj = obj[0];
            }
            if (!obj.hasOwnProperty(inc.as) && !obj.dataValues.hasOwnProperty(inc.as)) {
                return false;
            } else if (inc.include instanceof Array && inc.include.length) {
                var result = checkIncluded(obj.dataValues[inc.as], inc.include);
                if (!result) {
                    return false;
                }
            }
        }
        return true;
    }
}

/*
 * getAssociationArray
 *
 * returns array of all models' associations in format matching "include" option
 * of "findAll", "reload", "findOne" etc.. methods.
 *
 * @param object options
 *        boolean includeNested
 *        array   exclude - [optional] associations which will be excluded from result
 *        array   include - [optional] associations which will be included in result
 * @return array
 */
function getAssociationArray(options) {
    var defaults = {
        includeNested: false,
        exclude: [],
        include: []
    }
    opt          = _.merge(defaults, options);
    //TODO `Models` should be list of cached model's from sequelize
    //currently it's only list of Models from libs/models/group/ folder
    var included = [];
    var self     = this;

    if (opt.exclude.length && opt.include.length) {
        throw new Error("Both 'exlude' and 'include' array options can not be set");
    }

    return loadAssociations(this, opt.includeNested, opt);

    //Recursive fn
    function loadAssociations(model, includeNestedAssociations, opt) {
        var include = [];
        var options = model.options;
        opt = opt || { exclude: [], include: [] };

        var parentName = _.upperFirst(_.camelCase(options.name.singular));
        // Insures, the model (parentName) method is called on is not included in output
        included.push(parentName);
        var excluded = (options.cache && options.cache.excludedAssociations) || [];
        excluded = _.union(excluded, opt.exclude);

        for (var name in model.associationList) {
            var association = model.associationList[name];

            if (   included.indexOf(name) == -1 // do not include already included association
                && (excluded.indexOf(name) == -1) // do not include associations which are excluded
                && (   !opt.include.length //include only if include array is not defined
                    || opt.include.indexOf(name) >= 0 ) // or if include array is defined and current association is listed in options.include array
                && model.associationList.hasOwnProperty(name)
            ) {
                included.push(name);

                var inc = {
                    model: model.modelManager.getModel(_.snakeCase(name).toLowerCase()),
                    as: model.getAsAttributeForInclude(name)
                };

                if (includeNestedAssociations) {
                    inc.include = loadAssociations(association.target, true);
                }
                include.push(inc);
            }
        }

        return include;

    }
}

/*
 * getAsAttributeForInclude
 *
 * @param string name
 * @return string
 */
function getAsAttributeForInclude(name) {
    var as = null;
    var associationName = this.associationList[name].options.name;
    if (this.associations.hasOwnProperty(associationName.singular)) {
        as = associationName.singular;
    } else {
        as = associationName.plural;
    }

    return as;
}

/*
 * normalize
 *
 * overrides toJSON method so that it include relations included in input.include array
 * and exclude all properties in input.exclude array from object result.
 *
 * Runs sanitizers received from "getSanitizers()" class method if defined.
 *
 * @param object input
 *        array include
 *         boolean includeNested - includes nested associations of associations included in "include" option array
 *        Object exclude
 *               array before - excludes properties from unserialized sequelize object (model's "dataValues object")
 *               array after - excludes properties from JSON serialized object (after calling toJSON method on sequelize model)
 * @param object options
 *        boolean runSanitizers [default=true]
 *        boolean cache [default=true]
 *        boolean includeNested [default=false]
 *
 * @return Instance
 *
 */
function normalize(input, options) {

    var inputDefaults = {
        include: [],
        exclude: {before: [], after: []}
    }

    var optionsDefaults = {
        runSanitizers: true,
        includeNested: false,
        cache: true
    }
    input   = _.merge(inputDefaults, input);
    options = _.merge(optionsDefaults, options);

    var self   = this;
    var Model  = this.Model;

    return new Promise(function(resolve, reject) {

        var include = Model.getAssociationArray({
            includeNested: options.includeNested,
            include: input.include
        });

        // get sanitizers function list
        var sanitizers = (Model.getSanitizers && options.runSanitizers && Model.getSanitizers()) || {};
        //if (options.runSanitizers instanceof Array) {
        //sanitizers = _.pick(sanitizers, function(fn, name) {
        //return options.runSanitizers.indexOf(name) !== -1;
        //});
        //}
        var funcs = [];


        // prepare sanitizer functions
        Object.keys(sanitizers).forEach(function(name) {
            (function(sanitizer) {
                funcs.push(function(callback) {
                    sanitizer.apply(self, arguments);
                });
            })(sanitizers[name]);
        });

        //Exclude objects' properties after required associations are loaded
        funcs.unshift(function(callback) {
            excludeFields(input.exclude.before, self.dataValues);
            return callback();
        });

        //Add handler for including unloaded but required associations
        funcs.unshift(function(callback) {
            if (!include.length) {
                return callback();
            }
            //TODO do we realy want here to load the doc from cache by default?
            return self.reload({include: include, cache: options.cache}).asCallback(callback);
        });

        async.series(funcs, function(err, result) {

            if (err) {
                return reject(err);
            }

            var toJSON = self.toJSON;
            self.toJSON = function() {
                var doc = toJSON.apply(self, arguments);

                //objects' properties being sanitized
                var sanitizedKeys = Object.keys(sanitizers);
                //we do not need result of previously "unshifted" function which is not sanitizer
                result.shift();

                //Sanitize doc
                for (var i in result) {
                    var sanitized = result[i];
                    var relatedProperty = sanitizedKeys[i];
                    if (sanitized) {
                        doc[sanitized.key || relatedProperty] = sanitized.value;
                    }
                }

                //Exclude objects' properties
                excludeFields(input.exclude.after, doc);

                return doc;
            }

            return resolve(self);
        });

    });
}

/*
 * excludeFields
 * Helper function which excludes given fields from object hierarchy.
 * It takes in account arrays in tree strom, not just objects...
 * eg.: fields = ["company.employees.name"]
 *   -> deletes "name" field for every employee in "company" property of given obj
 *
 * @param Array fields
 * @param Object|Array obj
 */
function excludeFields(fields, obj) {
    var keys = {};
    for (var i in fields) {
        var splited = fields[i].split(".");
        splited = splited.length > 1 ? splited : splited[0];

        if (Array.isArray(splited)) {
            sortKeys(splited, keys);
        } else if(!keys.hasOwnProperty(splited)) {
            keys[splited] = {};
        }
    }

    deleteKeys(keys, obj);

    /*
     * sortKeys
     * create tree graph of fields that should be removed
     *
     * @param Array keys
     * @param Object pool [optional] - output object
     */
    function sortKeys(keys, pool) {
        pool = pool || {};

        var key = keys.shift();
        if (!pool.hasOwnProperty(key)) {
            pool[key] = {};
        }

        if (keys.length) {
            var subPool = sortKeys(keys, pool[key]);
        }
        return pool;
    }

    /*
     * deleteKeys
     *
     * deletes keys from obj
     *
     * @param Object keys - sorted keys hash map representing fields to delete
     * @param Object|Array obj - object given keys should be deleted from
     * @param string index [optional] - used for recursive loop
     *
     */
    function deleteKeys(keys, obj, key) {
        var indexes = Object.keys(keys);

        if (indexes.length) {
            if (obj instanceof Array) {
                for (var i in obj) {
                    for (var x in indexes) {
                        var index = indexes[x];
                        deleteKeys(keys[index], obj[i][key] || obj[i], index);
                    }
                }
                return;
            } else {
                for (var i in indexes) {
                    var index = indexes[i];
                    deleteKeys(keys[index], obj[key] || obj, index);
                }
                return;
            }
        } else {
            return obj[key] = undefined;
        }
    }
}


/*
 * search
 *
 * @param object input
 *        Any of the sequelize model's attributes,
 *        plus property names of object returned by model's "getSearchRelations" function,
 *        may include additional "order", "limit", "offset", "count_only" or "refresh_cache" properties
 *        Array   include - array of associations which should be included in results
 * @param {Object}  [options]
 * @param {Boolean} [options.queryLogging]
 * @param {Boolean} [options.getOnly=false]
 * @param {Object}  [options.attributes] - See Sequelize.Model.findAll options for more details
 * @param {Array}   [options.attributes.include] - See Sequelize.Model.findAll options for more details
 * @param {Array}   [options.attributes.exclude] - See Sequelize.Model.findAll options for more details
 * @param {Boolean} [options.cache] - applicable only if "refresh_cache" flag is not used
 * @returns {Promise<Object||Array>}
 */
function search(input, options) {

    var defaults = {
        queryLogging: undefined,//important!
        cache: false
    }

    options = _.assign(defaults, options || {});

    var filter = {
        limit   : input.limit || 20,
        offset  : input.offset || 0,
        paranoid: (input.include_deleted !== undefined ? !JSON.parse(input.include_deleted) : true),
        where   : {},
        include : input.include || [],
        order   : input.order || [["id", "ASC"]], // input is validated by sequelize (if array is provided)
        subQuery: options.subQuery,
        attributes: options.attributes
    };

    delete options.attributes;

    var getOnly = options.getOnly || false;
    var countOnly = input.count_only || false;
    var refreshCache = input.refresh_cache || false;
    var relations = ( this.getSearchRelations && this.getSearchRelations() ) || {};

    if (refreshCache && (!this.options.cache || !this.options.cache.storage)) {
        return Promise.reject(new ServiceError({
            message: 'Cache operations not supported.'
        }));
    }

    if (countOnly) {
        for (var i in relations) {
            if (relations.hasOwnProperty(i)) {
                var name = relations[i];
                if (input.hasOwnProperty(name)) {
                    return Promise.reject(new ServiceError({
                        message: 'Relation filtering not supported if count_only flag is supplied.'
                    }));
                }
            }
        }
    }

    delete input.limit;
    delete input.offset;
    delete input.order;
    delete input.include;
    delete input.count_only;
    delete input.refresh_cache;

    var schema = this.rawAttributes;
    var include = {};

    //Include staticaly included (not through request filter parameters) associations
    filter.include.forEach(function(assoc) {
        var assocName = _.upperFirst(_.camelCase(assoc.model.options.name.singular));
        include[assocName] = assoc;
    });

    //Filter search results by groups` properties

    for (var name in input) {
        var value = input[name];

        if (schema.hasOwnProperty(name)) {
            var field = schema[name];
            var search = field.search;


            if (Array.isArray(value)) {
                search = search && search.getSeededFilter('multi', value);
                filter.where[name] = search || {$in: value};
            } else {
                search = search && search.getSeededFilter('one', value);
                filter.where[name] = search || value;
            }
        }

        //Filtering by model's relations
        if (relations.hasOwnProperty(name)) {
            var relation = relations[name];
            var search = relation.search;
            var model = this.modelManager.getModel(_.snakeCase(relation.model).toLowerCase());
            var condition = {};

            if (relation.couldBeArray && Array.isArray(value)) {
                search = search && search.getSeededFilter('multi', value);
                condition[relation.key || 'id'] = search || {$in: value};
            } else {
                search = search && search.getSeededFilter('one', value);
                condition[relation.key || 'id'] = search || value;
            }

            var as = null;
            var associationName = this.associationList[relation.model].options.name;
            if (this.associations.hasOwnProperty(associationName.singular)) {
                as = associationName.singular;
            } else {
                as = associationName.plural;
            }

            //Check if association is already included, if so, use that association
            if (include.hasOwnProperty(relation.model)) {
                include[relation.model].where = condition;
            } else {
                include[relation.model] = {
                    model: model,
                    //If your association are set up with an 'as' (eg. X.hasMany(Y, { as: 'Z },
                    //you need to specify Z in the 'as' attribute when eager loading Y).
                    as: as,
                    where: condition
                };
            }


        }
    }
    filter.include = _.values(include);// returns array of models' values

    //Nested relation ordering
    if  (Array.isArray(filter.order) ) {
        for (var i in filter.order) {
            var order = filter.order[i];

            if (Array.isArray(order) && order.length === 3) {
                var relName = _.upperFirst(_.camelCase(order[0]));
                if ( !this.associationList.hasOwnProperty(relName) ) {
                    return Promise.reject(new ServiceError({
                        message: 'The relation was not found. Can not order by it'
                    }));
                }
                //var model = models[relName];
                var model = this.modelManager.getModel(_.snakeCase(order[0]).toLowerCase());
                if (include.hasOwnProperty(relName)) {
                    filter.order[i][0] = {model: model, as: include[relName].as};
                } else {
                    filter.include.push({
                        model: model
                    });
                    filter.order[i][0] = model;
                }
            }
        }
    }

    //Turn off generated query logging if desirable
    if (options.queryLogging !== undefined) {
        filter.logging = options.queryLogging;
    }

    filter.cache = options.cache;


    var method;

    if (getOnly) {
        method = 'findAll'
    } else if (countOnly) {
        method = 'count';
    } else if (refreshCache) {
        method = "refreshCache";
    } else {
        method = 'findAndCount';
        filter.distinct = true;
    }

    //Search
    return this[method](filter);
}
