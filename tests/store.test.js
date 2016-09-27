/* eslint-env node, mocha */

describe('db', function() {
    var chai = require('chai');
    var chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);
    chai.should();

    var Store = require('../app/store');
    var db = new Store({
        db: 'test'
    });

    beforeEach(function() {
        return db.clear()
            .then(function() {
                return db.insert([
                    {id: 1, title: 'The Movie One'},
                    {id: 2, title: 'The Movie Second'},
                    {id: 3, title: 'The Movie Third'}
                ]);
            });
    });

    describe('clear()', function() {
        it('deletes all records', function() {
            return db.clear().should.eventually.have.property('deleted', 3);
        });
    });

    describe('getAll()', function() {
        it('responds with all records', function() {
            return db.getAll().should.eventually.have.length(3);
        });
    });

    describe('insert()', function() {
        it('inserts one record', function() {
            return db.insert({
                id: 4,
                title: 'The Movie Fourth'
            }).should.eventually.have.property('inserted', 1);
        });
    });

    describe('insert()', function() {
        it('inserts multiple records', function() {
            return db.insert([
                {id: 4, title: 'The Movie Fourth'},
                {id: 5, title: 'The Movie Fifth'}
            ]).should.eventually.have.property('inserted', 2);
        });
    });

    describe('update()', function() {
        it('updates data property', function() {
            return db.update({
                id: 3,
                title: 'Third'
            }).should.eventually.have.property('replaced', 1);
        });
    });

    describe('delete()', function() {
        it('deletes one record', function() {
            return db.delete(3).should.eventually.have.property('deleted', 1);
        });
    });

    describe('delete()', function() {
        it('deletes multiple records', function() {
            return db
                .delete([1, 2])
                .should.eventually.have.property('deleted', 2);
        });
    });

    describe('clean()', function() {
        it('deletes records if `id` not present in the given data', function() {
            return db.cleanDiff([
                 {id: 2, title: 'The Movie Second'}
            ]).should.eventually.have.property('deleted', 2);
        });
    });
});
