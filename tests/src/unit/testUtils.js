var _  = require('lodash');
var fs = require('fs');

before(function() {
    this.createFileTree = createFileTree;

    /*
     * createFileTree
     *
     * helper function which will create directory & file tree ctructure
     * on the filesystem according to received tree schema
     *
     * @param {Object} tree
     * @param {String} dir - path to temporary directory
     */
    function createFileTree(tree, dir) {
        Object.keys(tree).forEach(function(name) {
            var value = tree[name];
            var path = dir + '/' + name;

            if (_.isPlainObject(value)) {
                fs.mkdirSync(path);
                return createFileTree(value, path);
            } else if(value === null) {
                return fs.writeFileSync(path, '');
            }
        });
    }
});
