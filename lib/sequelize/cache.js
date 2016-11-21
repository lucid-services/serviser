var sequelize    = require('sequelize');
var _            = require('lodash');
var couchbase    = require('couchbase');
var Promise      = require('bluebird');
var debug        = require('debug')('sequelize-cache');

var objectFilter = require('../objectFilter');
var CacheError = require('./error/cacheError');

/*
 * refreshInstanceCache
 * refreshes cache of particular model instance
 *
 * @param object options
 *        boolean reload - if true, reloads model with all relations before refreshing cache
 */
module.exports.refreshInstanceCache = function(options) {

    var self = this;
    var cache = this.Model.options.cache;
    options = options || {};

    if (!cache || !cache.storage) {
        return Promise.resolve(self);
    }

    return (options.reload === true
     ? reload()
     : Promise.resolve())
    .then(function() {
        return cache.storage.upsert(self.id, self.toJSON()).return(self);
    });

    function reload() {
        try{
            var include = self.Model.getAssociationArray({
                includeNested: cache.includeNestedRelations
            });
        } catch(e) {
            return Promise.reject(e);
        }
        var opt = {include: include, cache: false};
        return self.reload(opt);
    }
}

/*
 * refreshCache
 *
 * class method
 * finds all docs matching options.where filter and updates cache of each one
 *
 * @param object options
 *
 */
module.exports.refreshCache = function(options) {

    var self = this;
    options = options || {};
    var cache = this.options.cache;

    if (!cache || !cache.storage) {
        return Promise.resolve(self);
    }

    return self.findAll(options).then(function(docs) {

        return Promise.map(docs || [], function(doc) {
            return doc.refreshCache({reload: true});//TODO - probably do not throw error straight away
        }).return(docs.length);
    });
}

/*
 * destroyInstanceCache
 *
 * deletes cache of a model instance
 *
 */
module.exports.destroyInstanceCache = function() {

    var cache = this.Model.options.cache;
    var self = this;

    if (!cache || !cache.storage) {
        return Promise.resolve();
    }

    return cache.storage.remove(self);
}

/*
 * buildFromCache
 *
 * @param object seq - sequelize instance
 * @return function
 */
module.exports.buildFromCache = function(seq) {
    /*
     * buildFromCache
     *
     * Builds sequelize model instance from cached data
     *
     * @param object data
     * @return Instance
     */
    return function(data) {

        var cache = this.options.cache;
        var include = this.getAssociationArray({
            includeNested: cache && cache.includeNestedRelations
        });

        seq.Model.$validateIncludedElements({model: this, include: include});
        var build = this.build(data, {
            isNewRecord      : false,
            include          : include,
            raw              : true
        });

        return build;
    }
}

/*
 * findAll
 *
 * returns overriden method so that it looks for cached data first
 * if cached data have not been found, it runs query to database
 *
 * @param function findAll - method being overriden
 * @param Sequelize seq - sequelize instance
 * return function
 */
module.exports.findAll = function(findAll, seq) {
    return function(options) {

        var self = this;
        var args = Array.prototype.slice.call(arguments, 0);
        var cache = this.options.cache;

        if ((!cache || !cache.storage) || options.cache === false) {
            return findAll.apply(self, args);
        }

        var where = options.where
        ,   conLenght = Object.keys(where || {}).length
        ,   indexList = cache && cache.storage.storage.getIndexList()
        ,   useCache = false
        ,   param;

        // should perform cache look up?
        // -> performs only if searching for single document and only if searching by one of the indexes
        // defined in options
        if (conLenght == 1) {
            var and = where.$and;
            if ( Array.isArray(and) && and.length == 2 ) {
                param = getKey(and[1], indexList);
                if (param !== undefined && "deleted_at" in and[0]) {
                    useCache = true;
                } else {
                    param = getKey(and[0], indexList);
                    if (param !== undefined && "deleted_at" in and[1]) {
                        useCache = true;
                    }
                }
            } else {
                var param = getKey(where, indexList);
                if (param !== undefined && !_.isObject(param.value)) {
                    useCache = true;
                }
            }
        }

        if (!useCache) {
            return findAll.apply(self, args);
        }

        var cacheMethod = getCacheMethod(param.key, cache.storage);
        if (cacheMethod === undefined) {
            return Promise.reject(new CacheError("Cache storage does not have get method for index " + param.key));
        }

        return cache.storage[cacheMethod](param.value).then(function(doc) {

            var build = self.buildFromCache(doc);
            debug("LOADING "+ self.name +" FROM CACHE");
            return (options.plain ? build : [build]);
        }, function(err) {

            if (err.code != couchbase.errors.keyNotFound) {
                return Promise.reject(err);
            }

            var include = self.getAssociationArray({includeNested: cache.includeNestedRelations});

            //args[1].include = [{all: true}];
            args[0].include = include;

            return findAll.apply(self, args).then(function(doc) {
                if (doc === null) {
                    return doc;
                }
                var isArray = Array.isArray(doc);
                if ( isArray ) {
                    if (doc.length > 1) {
                        return Promise.reject(new CacheError("Unexpected response data length"));
                    }

                    if (!doc.length) {
                        return doc;
                    }

                    doc = doc.shift();
                }

                return doc.refreshCache().then(function(doc) {
                    return (isArray ? [doc] : doc);
                });
            });
        });

        function getKey(obj, indexList) {
            var key = _.intersection(indexList || [], Object.keys(obj || {}));
            if (key.length == 1) {
                return {key: key[0], value: obj[key[0]]};
            }
        }

        function getCacheMethod(indexName, cacheStorage) {
            if (indexName == "id") {
                return "get";
            } else {
                var name = "getBy" + _.upperFirst(indexName.toLowerCase());
                if (typeof cache.storage[name] == 'function') {
                    return name;
                }
            }
        }
    }
};

/*
 * update
 *
 * TODO reimplement this! do not build instances of updated records, but rather select only `ids`
 * of updated records and update cache via row id. => implement Model.refreshCache(id)
 *
 * returns overriden method so that it refreshes cache data after
 * update query has been performed
 *
 * @param function updateFn - method being overriden
 * return function
 */
module.exports.update = function(updateFn) {
    /*
     * update
     *
     * @param object values
     * @param object options
     *        boolean cache - if === false, runs original method, cache is ignored
     */
    return function(values, options) {

        options = options || {};
        options.returning = true;
        var self = this;
        var args = Array.prototype.slice.call(arguments, 0);
        var cache = this.options.cache;

        var update = updateFn.apply(self, args);

        if (options.cache === false || !cache || !cache.storage) {
            return update;
        }

        return update.then(function(result) {

            var docs = result[1];
            return Promise.map(docs || [], function(doc) {
                //TODO - probably do not throw error straight away
                return doc.refreshCache({reload:true});
            });
        });

    }
};

/*
 * save
 *
 * returns overriden method so that it refreshes cache data after
 * save (update) query has been performed
 *
 * @param function saveFn - method being overriden
 * return function
 */
module.exports.save = function(saveFn) {

    /*
     * save
     *
     * @param object options
     *        boolean cache - if === false, runs original method, cache is ignored
     */
    return function(options) {

        options = options || {};
        options.returning = true;
        var self = this;
        var args = Array.prototype.slice.call(arguments, 0);
        var cache = this.Model.options.cache;

        var save = saveFn.apply(self, args);

        if ((!cache || !cache.storage) || options.cache === false) {
            return save;
        }

        if (options.transaction) {
            return Promise.reject(new CacheError("Transactions with cache option not supported for save() method"));
        }

        return save.then(function(doc) {
            debug("CALLING REFRESH CACHE ON " + self.Model.name);
            return doc.refreshCache({reload: true});
        });
    }
};

/*
 * destroy
 *
 * returns overriden method so that it deletes cached data after
 * delete query has been performed on one model instance
 *
 * @param function destroyFn - method being overriden
 * return function
 */
module.exports.destroy = function(destroyFn) {

    /*
     * save
     *
     * @param object options
     *        boolean cache - if === false, runs original method, cache is ignored
     */
    return function(options) {

        options = options || {};
        var self = this;
        var args = Array.prototype.slice.call(arguments, 0);
        var cache = this.Model.options.cache;

        var destroy = destroyFn.apply(self, args);

        if ((!cache || !cache.storage) || options.cache === false) {
            return destroy;
        }

        return destroy.then(function(num) {
            return self.destroyCache().return(num);
        });
    }
};


/*
 * destroyMulti
 *
 * TODO reimplement this! do not build instances, but rather select only `ids`
 * of records being deleted and invalidate cache via row id. => implement Model.destroyCache(id)
 *
 * returns overriden method so that it deletes cached data after
 * delete query has been performed
 *
 * @param function destroyFn - method being overriden
 * @param function findAll   - orginal `Model.findAll` method dependency
 * return function
 */
module.exports.destroyMulti = function(destroyFn, findAll) {

    /*
     * destroy
     *
     * @param object options
     *        boolean cache - if === false, runs original method, cache data are ignored
     */
    return function(options) {

        options = options || {};
        var self = this;
        var args = Array.prototype.slice.call(arguments, 0);
        var cache = this.options.cache;

        if ((!cache || !cache.storage) || options.cache === false) {
            return destroyFn.apply(self, args);
        }

        var indexList = cache.storage.storage.getIndexList();
        var opt = _.clone(options, true);
        opt.attributes = indexList;

        return findAll.apply(self, [opt]).bind({}).then(function(docs) {
            this.docs = docs;
            return destroyFn.apply(self, args);
        }).then(function(num) {

            //temporarly increase event listeners limit
            process.setMaxListeners(0);
            return Promise.map(this.docs || [], function(doc) {
                return doc.destroyCache();//TODO - what to do with potential error here?
            }).then(function(num) {
                process.setMaxListeners(10);
            });
        });

    }
};

module.exports.belongsTo = {
    injectGetter: overrideInjectGetter,
}

module.exports.hasOne = {
    injectGetter: overrideInjectGetter,
}

module.exports.hasMany = {
    get   : hasManyGetAssociation,
    has   : hasManyHasAssociation,
    count : hasManyCountAssociations,
    set   : hasManySetAssociations,
    add   : hasManyAddAssociations,
    remove: hasManyRemoveAssociations
}

module.exports.belongsToMany = {
    injectGetter: belongsToManyOverrideInjectGetter,
    injectSetter: belongsToManyOverrideInjectSetter,
}

/*
 * overrideInjectGetter
 *
 * returns overriden method for "belongsTo", "hasOne" relations
 * so that it returns cached data if available
 * if "cache" option on "getAssociation" method is set to "false",
 * cache data are ignored and query is always run
 *
 * @param function injectGetter - original method being overriden
 * @return function
 */
function overrideInjectGetter(injectGetter) {
    return function(instancePrototype) {
        var association = this;
        var proxy = new Object;
        injectGetter.apply(association, [proxy]);

        if (proxy.hasOwnProperty(association.accessors.get)) {
            var getAssociationOrg = proxy[association.accessors.get];

            //override getAssociation method
            instancePrototype[association.accessors.get]
            = overrideGetAssociation(association, getAssociationOrg, true);
        } else {
            var message = "getAssociation method not found";
            throw new CacheError(message);
        }
    }
}

/*
 * belongsToManyOverrideInjectSetter
 *
 * returns overriden method for "belongsToMany" relation
 * so that it refreshes cached data after original sequelize method is run
 * if "cache" option on "setAssociation/s" method is set to "false",
 * cache data are ignored - only original method is run
 *
 * @param function injectSetter - original method being overriden
 * @return function
 */
function belongsToManyOverrideInjectSetter(injectSetter) {
    return function(instancePrototype) {
        var association = this;
        var proxy = new Object;
        injectSetter.apply(association, [proxy]);

        if (proxy.hasOwnProperty(association.accessors.set)) {
            var setAssocOrg = proxy[association.accessors.set];

            //override setAssociation method
            instancePrototype[association.accessors.set]
            = overrideSetAssociation(association, setAssocOrg);
        } else {
            var message = "setAssociation method not found";
            throw new CacheError(message);
        }

        if (proxy.hasOwnProperty(association.accessors.addMultiple)) {
            var addMultipleAssocOrg = proxy[association.accessors.addMultiple];

            //override addAssociations method
            instancePrototype[association.accessors.addMultiple]
            = overrideAddAssociation(association, addMultipleAssocOrg);
        } else {
            var message = "addAssociations method not found";
            throw new CacheError(message);
        }

        if (proxy.hasOwnProperty(association.accessors.removeMultiple)) {
            var removeMultipleAssocOrg = proxy[association.accessors.removeMultiple];

            //override removeAssociations method
            instancePrototype[association.accessors.removeMultiple]
            = overrideRemoveAssociation(association, removeMultipleAssocOrg);
        } else {
            var message = "removeAssociations method not found";
            throw new CacheError(message);
        }
    }
}

/*
 * belongsToManyOverrideInjectGetter
 *
 * returns overriden method for "belongsToMany" relation
 * so that it returns cached data if available
 * if "cache" option on "getAssociation" method is set to "false",
 * cache data are ignored and query is always run
 *
 * @param function injectGetter - original method being overriden
 * @return function
 */
function belongsToManyOverrideInjectGetter(injectGetter) {
    return function(instancePrototype) {
        var association = this;
        var proxy = new Object;
        injectGetter.apply(association, [proxy]);

        if (proxy.hasOwnProperty(association.accessors.get)) {
            var getAssociationOrg = proxy[association.accessors.get];

            //override getAssociation method
            instancePrototype[association.accessors.get]
            = overrideGetAssociation(association, getAssociationOrg, false);
        } else {
            message = "getAssociations method not found";
            throw new CacheError(message);
        }

        if (proxy.hasOwnProperty(association.accessors.count)) {
            var countAssocOrg = proxy[association.accessors.count];

            //override countAssociations method
            instancePrototype[association.accessors.count]
            = belongsToManyCountAssociations(association, countAssocOrg);
        } else {
            message = "countAssociations method not found";
            throw new CacheError(message);
        }

        if (proxy.hasOwnProperty(association.accessors.hasSingle)) {
            var hasSingle = proxy[association.accessors.hasSingle];

            //override hasSingle method
            instancePrototype[association.accessors.hasSingle]
            = belongsToManyHasAssociation(association, hasSingle);
        } else {
            message = "hasAssociation method not found";
            throw new CacheError(message);
        }

        if (proxy.hasOwnProperty(association.accessors.hasAll)) {
            var hasAll = proxy[association.accessors.hasAll];

            //override hasAll method
            instancePrototype[association.accessors.hasAll]
            = belongsToManyHasAssociation(association, hasAll);
        } else {
            message = "hasAssociations method not found";
            throw new CacheError(message);
        }
    }
}

/*
 * overrideGetAssociation
 *
 * returns overriden model's instance method "getAssociation/s" so that it returns cached data if available.
 * if "cache" option on model's "getAssociation/s" method is set to "false",
 * cache data are ignored and query is always run
 *
 * @param object association
 * @param function getAssociation - method being overriden
 * @param boolean singular
 * @return function
 */
function overrideGetAssociation(association, getAssociation, singular) {
    return function(options) {

        var self = this;
        options = options || {};

        var useCache = true;
        var include  = options.include;
        var name     = association.options.name;
        name         = singular ? name.singular : name.plural;

        if (include) {
            var associationData = this[name] || this.dataValues[name];
            useCache = this.checkAssocIfIncluded.call(associationData, include);
            debug("ALL REQUIRED ASSOCIATIONS INCLUDED => ", useCache);
        }


        if (   !useCache
            || options.cache === false
            || (!this.hasOwnProperty(name) && !this.dataValues.hasOwnProperty(name))
        ) {
            return getAssociation.apply(this, arguments);
        }

        debug("RETURNING FROM CACHE", name);
        return new Promise(function(resolve, reject) {
            var data = self[name] || self.dataValues[name];
            // if method overriding method of belongs to many / has many association,
            // `where` filter object option is allowed
            // `singular` is true only if the assoction is of type hasOne/belongsTo
            if (!singular && _.isObject(options.where)) {
                try {
                    data = objectFilter.filterData(data || [], options.where);
                } catch(e) {
                    return reject(e);
                }
            }
            return resolve(data);
        });
    }
}

/*
 * overrideSetAssociation
 *
 * returns overriden method so that it refreshes cached data after they're updated
 * if "cache" option on "setAssociations" method is set to "false",
 * cache data are ignored - only original method is run
 *
 * @param object association
 * @param function setAssociation - method being overriden
 * @param boolean singular
 * @return function
 */
function overrideSetAssociation(association, setAssociation) {
    return function(newAssociatedObjects, options) {

        var self = this;
        options = options || {};

        var promise = setAssociation.apply(this, arguments);

        if (options.cache === false) {
            return promise;
        }


        return promise.then(function(res) {
            debug("REFRESHING CACHE ON ", self.Model.name);
            if (res.length == 0) {
                return res;
            }

            return self.refreshCache({reload: true}).return(res);
        });
    }
}

/*
 * overrideAddAssociation
 *
 * returns overriden method so that it refreshes cached data after they're updated
 * if "cache" option on "addAssociations" method is set to "false",
 * cache data are not refreshed - only original method is run
 *
 * @param object association
 * @param function addAssociation - method being overriden
 * @param boolean singular
 * @return function
 */
function overrideAddAssociation(association, addAssociation) {
    return function(newAssociatedObjects, options) {

        var self = this;
        options = options || {};

        debug("ADD ASSOCIATION", association.options.name);
        var promise = addAssociation.apply(this, arguments);

        if (options.cache === false) {
            return promise;
        }

        return promise.then(function(res) {
            debug("REFRESHING CACHE ON ", self.Model.name);
            if (res.length == 0) {
                return res;
            }

            //true=force reload from db
            return self.refreshCache({reload: true}).return(res);
        });
    }
}

/*
 * overrideRemoveAssociation
 *
 * returns overriden method so that it refreshes cached data after association is removed
 * if "cache" option on "removeAssociation" method is set to "false",
 * cache data are not refreshed - only original method is run
 *
 * @param object association
 * @param function removeAssociation - method being overriden
 * @param boolean singular
 * @return function
 */
function overrideRemoveAssociation(association, removeAssociation) {
    return function(removalCollection, options) {

        var self = this;
        options = options || {};

        var promise = removeAssociation.apply(this, arguments);

        if (options.cache === false) {
            return promise;
        }

        return promise.then(function(res) {
            debug("REFRESHING CACHE ON ", self.Model.name);
            if (res.length == 0) {
                return res;
            }

            //true=force reload from db
            return self.refreshCache({reload: true}).return(res);
        });
    }
}

/*
 * belongsToManyCountAssociations
 *
 * returns overriden model's instance method "countAssociations" so that it
 * permorms count on cached data if available otherwise runs db query to get associations
 * and then performs count.
 * if "cache" option on model's "countAssociations" method is set to "false",
 * cache data are ignored and query is always run
 *
 * @param object association
 * @param function countAssociations - method being overriden
 * @return function
 */
function belongsToManyCountAssociations(association, countAssociations) {
    return function(options) {

        options = options || {};
        var name = association.options.name.plural;

        if (   options.cache === false
            || (!this.hasOwnProperty(name) && !this.dataValues.hasOwnProperty(name))
        ) {
            return countAssociations.apply(this, arguments);
        }

        debug("PERFORMING COUNT ON CACHED ASSOCIATION LIST ", name);
        try {
            var data = this[name] || this.dataValues[name];
            if (_.isPlainObject(options.where)) {
                try {
                    data = objectFilter.filterData(data || [], options.where);
                } catch(e) {
                    return reject(e);
                }
            }
            return Promise.resolve(data.length);
        } catch(e) {
            return Promise.reject(e);
        }

    }
}

/*
 * belongsToManyHasAssociation/s
 *
 * returns overriden model's instance method "hasAssociation/s" so that it
 * checks if instance has association on cached data if data are available
 * otherwise runs db query to get associations
 *
 * if "cache" option on object's "hasAssociation/s" method is set to "false",
 * cache data are ignored and query is always run
 *
 * @param object association
 * @param function hasAssociation - method being overriden
 * @return function
 */
function belongsToManyHasAssociation(association, hasAssociation) {
    return function(instances, options) {

        options = options || {};

        if (!Array.isArray(instances)) {
            instances = [instances];
        }

        var name = association.options.name.plural;

        if (options.cache === false
            || (!this.hasOwnProperty(name) && !this.dataValues.hasOwnProperty(name))
        ) {
            return hasAssociation.apply(this, arguments);
        }

        var result = true;
        var associationData = this[name] || this.dataValues[name];

        loop1: for (var i=0, len = instances.length; i < len; i++) {
            var instance = instances[i];
            var checkInstance = false;
            if (instance instanceof association.target.Instance) {
                checkInstance = true;
            }

            loop2: for (var y=0, len2 = associationData.length; y < len2; y++) {
                var rel = associationData[y];

                var primKey = association.target.primaryKeyAttribute;

                if (  (checkInstance && instance[primKey] == rel[primKey])
                    || (!checkInstance && instance == rel[primKey])
                   ) {
                    break loop2;
                }

                if (y == len2 -1) {
                    result = false;
                    break loop1;
                }
            }
        }

        debug(name, "PERMORMING HAS OPERATION ON CACHED DATA WITH RESULT", result);
        return Promise.resolve(result);

    }
}

/*
 * hasManyGetAssociation
 *
 * returns overriden method so that it returns cached data if available
 * if "cache" option on model's "getAssociation" method is set to "false",
 * cache data are ignored and query is always run
 *
 * @param function getFn - method being overriden
 * @return function
 */
function hasManyGetAssociation(getFn) {

    return function(instances, options) {

        options         = options || {};
        var association = this;
        var name        = association.options.name.plural;
        var useCache    = true;
        var include     = options.include;

        if (Array.isArray(instances) && options.cache !== false) {
            var err = new CacheError('cache options not supported if "instances" is an array');
            return Promise.reject(err);
        }

        if (include) {
            var associationData = instances[name] || instances.dataValues[name];
            useCache = associationData && instances.checkAssocIfIncluded.call(associationData, include);
            debug("ALL REQUIRED ASSOCIATIONS INCLUDED => ", useCache);
        }

        if (!useCache || options.cache === false || (!instances.hasOwnProperty(name) && !instances.dataValues.hasOwnProperty(name) ) ) {
            debug("MATCHING ASSOCIATION FROM DB", name);
            return getFn.apply(this, arguments);
        }

        debug("RETURNING ASSOCIATION FROM CACHE", name);
        return new Promise(function(resolve, reject) {
            var data = instances.dataValues[name];
            if (_.isObject(options.where)) {
                try {
                    data = objectFilter.filterData(data || [], options.where);
                } catch(e) {
                    return reject(e);
                }
            }
            return resolve(data);
        });
    }

}

/*
 * hasManyHasAssociation
 *
 * returns overriden method so that it returns cached data if available
 * if "cache" option on model's "hasAssocation/s" method is set to "false",
 * cache data are ignored and query is always run
 *
 * @param function hasAssociation - method being overriden
 * @return function
 */
function hasManyHasAssociation(hasAssociation) {

    return function(sourceInstance, instances, options) {

        var self = sourceInstance;
        association = this;
        options = options || {};

        if (!Array.isArray(instances)) {
            instances = [instances];
        }

        var name = association.options.name.plural;

        if (   options.cache === false
            || (!self.hasOwnProperty(name) && !self.dataValues.hasOwnProperty(name))
        ) {
            return hasAssociation.apply(this, arguments);
        }

        var result          = true;
        var associationData = self[name] || self.dataValues[name];

        loop1: for (var i = 0, len = instances.length; i < len; i++) {
            var instance = instances[i];
            var checkInstance = false;
            if (instance instanceof association.target.Instance) {
                checkInstance = true;
            }

            loop2: for (var y = 0, len2 = associationData.length; y < len2; y++) {
                var rel = associationData[y];

                var primKey = association.target.primaryKeyAttribute;

                if (  (checkInstance && instance[primKey] == rel[primKey])
                    || (!checkInstance && instance == rel[primKey])
                   ) {
                    break loop2;
                }

                if (y == len2 -1) {
                    result = false;
                    break loop1;
                }

            }
        }

        debug("PERFORMING HAS ASSOCITATION ON CACHED DATA WITH RESULT", result);
        return Promise.resolve(result);

    }
}

/*
 * hasManyCountAssociations
 *
 * returns overriden model's instance method "countAssociations" so that it
 * permorms count on cached data if available otherwise runs db query to get associations
 * and then performs count.
 * if "cache" option on model's "countAssociations" method is set to "false",
 * cache data are ignored and query is always run
 *
 * @param function countAssociation - method being overriden
 * @return function
 */
function hasManyCountAssociations(countAssociation) {

    return function(sourceInstance, options) {
        var self = sourceInstance;
        var association = this;
        options = options || {};

        var name = association.options.name.plural;

        if (   options.cache === false
            || (!self.hasOwnProperty(name) && !self.dataValues.hasOwnProperty(name))
        ) {
            return countAssociation.apply(this, arguments);
        }

        debug("PERFORMING COUNT OPPERATION ON CACHED ASSOCIATION", name);
        return new Promise(function(resolve, reject) {

            var data = self[name] || self.dataValues[name];
            if (_.isPlainObject(options.where)) {
                try {
                    data = objectFilter.filterData(data || [], options.where);
                } catch(e) {
                    return reject(e);
                }
            }
            return resolve(data.length);
        });
    }
}

/*
 * hasManySetAssociations
 *
 * returns overriden model's instance method "setAssociations" so that it
 * refreshes cached data of the instance after relation to the association/s is set
 * if "cache" option on "setAssociations" method is set to "false",
 * cache data are ignored - only original method is run

 * @param function setAssociation - method being overriden
 * @return function
 */
function hasManySetAssociations(setAssociation) {

    return function(sourceInstance, instances, options) {
        var self = sourceInstance;
        var association = this;
        options = options || {};

        var promise = setAssociation.apply(this, arguments);

        if (options.cache === false) {
            return promise;
        }

        return promise.then(function(sourceInstance) {
            //true=force reload from db
            return self.refreshCache({reload: true}).return(sourceInstance);//doc == sourceInstance
        });
    }
}

/*
 * hasManyAddAssociations
 *
 * returns overriden model's instance method "addAssociations" so that it
 * refreshes cached data of the instance after relation to the assocition/s is set
 * if "cache" option on "addAssociations" method is set to "false",
 * cache data are not refreshed - only original method is run

 * @param function addAssociation - method being overriden
 * @return function
 */
function hasManyAddAssociations(addAssociation) {

    return function(sourceInstance, instances, options) {
        var self = sourceInstance;
        var association = this;
        options = options || {};

        var promise = addAssociation.apply(this, arguments);

        if (options.cache === false) {
            return promise;
        }

        return promise.then(function(sourceInstance) {
            //true=force reload from db
            return self.refreshCache({reload: true}).return(sourceInstance); //doc == sourceInstance
        });
    }
}

/*
 * hasManyRemoveAssociations
 *
 * returns overriden model's instance method "removeAssociation/s" so that it
 * refreshes cached data after assocation is removed
 * if "cache" option on "addAssociations" method is set to "false",
 * cache data are not refreshed - only original method is run

 * @param function removeAssociation - method being overriden
 * @return function
 */
function hasManyRemoveAssociations(removeAssociation) {

    return function(sourceInstance, instances, options) {
        var self = sourceInstance;
        var association = this;
        options = options || {};

        var promise = removeAssociation.apply(this, arguments);

        if (options.cache === false) {
            return promise;
        }

        return promise.then(function(sourceInstance) {
            //true=force reload from db
            return self.refreshCache({reload: true}).return(sourceInstance);//doc == sourceInstance
        });
    }
}
