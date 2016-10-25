var _  = require('lodash');

module.exports.filterData = filterData;
module.exports.buildAssertion = buildAssertion;
module.exports.buildCondition = buildCondition;
module.exports.buildWhere = buildWhere;

var conditions = module.exports.conditions = {
    /*
     * $and
     *
     * returns true if all assertions are resolved
     *
     * @param {Array} this.pool
     * @return {boolean}
     */
    $and: function() {
        var assertions = this.pool;

        for (var i = 0, len = assertions.length; i < len; i++) {

            if (assertions[i]() === false) {
                return false
            }
        }
        return true;
    },
    /*
     * $or
     *
     * returns true if at least one assertion is resolved
     *
     * @param {array} this.pool
     * @return {boolean}
     */
    $or: function() {

        var assertions = this.pool;

        for (var i = 0, len = assertions.length; i < len; i++) {

            if (assertions[i]() === true) {
                return true;
            }
        }
        return false;
    }
};

var assertions = module.exports.assertions = {
    $gt: function() {
        return this.val > this.filter;
    },
    $gte: function() {
        return this.val >= this.filter;
    },
    $lt: function() {
        return this.val < this.filter;
    },
    $lte: function() {
        return this.val <= this.filter;
    },
    $eq: function() {
        return this.val == this.filter;
    },
    $ne: function() {
        return this.val != this.filter;
    },
    $between: function() {
        return this.val >= this.filter[0] && this.val <= this.filter[1];
    },
    $notBetween: function() {
        return !this.assertions.$between.call(this);
    },
    /*
     * $like
     *
     * behaves like sql `LIKE` operator
     * possible setup:
     * 1.   $like: { $any: ['cat', 'hat']}
     * 2.   $like: "some-string"
     *
     * @param {Object|string} this.filter
     * @param {string}        this.value
     * @param {object}        this.assertions
     *
     * @return {boolean}
     */
    $like: function() {
        if (_.isPlainObject(this.filter) && this.filter.$any instanceof Array) {
            var context = {
                assertions : this.assertions,
                val        : this.val,
                filter     : null
            };
            for (var i = 0, len = this.filter.$any; i < len; i++) {
                context.filter = this.filter.$any[i];
                var result = like.call(context);
                if (result) {
                    return true;
                }
            }
            return false;
        } else if(!_.isObject(this.filter)) {
            return like.call(this);
        }

        function like() {
            var extendLeft = this.filter.charAt(0) === "%";
            var extendRight = this.filter.charAt(this.filter.length -1) === "%";

            var filter = this.filter;
            if (extendLeft) filter = filter.substr(1);
            if (extendRight) filter = filter.substr(0, filter.length -1);

            var existsAt = this.val.indexOf(filter);

            if (existsAt === -1) {
                return false;
            } else if (!extendLeft && existsAt > 0) {
                return false;
            } else if (!extendRight && (existsAt + filter.length) < this.val.length ) {
                return false;
            }

            return true;
        }
    },
    $notLike: function() {
        return !this.assertions.$like.call(this);
    },
    /*
     * $iLike
     *
     * case insensetive `$like` version
     *
     * @param {Object|string} this.filter
     * @param {string}        this.value
     * @param {object}        this.assertions
     *
     * @return boolean
     */
    $iLike: function() {
        this.val = this.val.toLowerCase();
        this.filter = this.filter.toLowerCase();
        return this.assertions.$like.call(this);
    },
    $notILike: function() {
        return !this.assertions.$iLike.call(this);
    },
    $in: function() {
        return this.filter.indexOf(this.val) != -1;
    },
    $any: function() {
        return this.assertions.$in.call(this);
    },
    $notIn: function() {
        return !this.assertions.$in.call(this);
    }
};

/*
 * buildWhere
 *
 * build array of assertion functions
 *
 * @param {object} data
 * @param {object} where - filter object
 * @param {string} comparisonOperator - one of the property names form `conditions` list
 *                                  - determines default comarison operator between multiple
 *                                    assertions in `where` filter object
 * @return array
 */
function buildWhere(data, where, comparisonOperator) {

    var pool = [];
    // loop through all assertion statements recursively
    Object.keys(where).forEach(function(prop) {
        if (assertions.hasOwnProperty(prop)) {
            pool.push( buildAssertion(data, where[prop], prop) );
        } else if (conditions.hasOwnProperty(prop)) { // yields new pool of assertions
            if (where[prop] instanceof Array) {
                var subPool = [];
                where[prop].forEach(function(subWhere) {
                    subPool.push(buildWhere(data, subWhere, comparisonOperator))
                });
                pool.push(buildCondition(subPool, prop));
            } else if(_.isPlainObject(where[prop])) {
                pool.push(buildWhere(data, where[prop], prop));
            }
        } else if(data.hasOwnProperty(prop)) {
            if (_.isPlainObject(where[prop])) {// yields new pool of assertions
                pool.push(buildWhere(data[prop], where[prop], comparisonOperator));
            } else if(!_.isObject(where[prop]) || where[prop] instanceof Array) {
                pool.push( buildAssertion(data[prop], where[prop], '$eq' ));
            }
        }
    });
    return buildCondition(pool, comparisonOperator);
}

/*
 * buildCondition
 *
 * @param {array} pool
 * @param {string} condType - see `conditions` list for available property values
 * @return {function}
 */
function buildCondition(pool, condType) {
    var context = {pool: pool};
    return fastBind(conditions[condType], context);
}

/*
 * buildAssertion
 *
 * @param {mixed} val - data value which is being inspected
 * @param {mixed} filterValue - value of one filter from `where` filter object
 * @param {string} assertType - see `assertions` list for available assertions
 * @return {function}
 */
function buildAssertion(val, filterValue, assertType) {
    var context = {
        val        : val,
        filter     : filterValue,
        assertions : assertions
    };
    return fastBind(assertions[assertType], context);
}

/*
 * @param {function} fn
 * @param {object} context
 * @return {object}
 */
function fastBind(fn, context) {
    return function() {
        return fn.call(context);
    }
}

/*
 * filterData
 *
 * returns array of objects which passed the defined filter
 *
 * @param {array} data - data being filtered
 * @param {object} where - filter definition objet
 * @return{} array
 */
function filterData(data, where) {
    return data.filter(function(obj) {
        return buildWhere(obj.dataValues, where || {}, '$and' )();
    });
}
