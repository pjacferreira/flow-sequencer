# flow-sequencer

## Basic Concept

While working with SailsJS I ran into the one of the pains of NodeJS programming: Nested Callbacks.
It's also one of the advantages of Node. Unfortunately, it makes for very ugly code.

The natural solution would be to use a module like 'async' to solve the problem.
But, I prefer to re-invent the wheel (Actually, I don't, I just needed
something that made my code easier to read, more granular/reusable).

So, I created this module, to try to create a BASIC like structure to callbacks.

It's probably easier just to show a piece of code to explain how it works:

```js
...
// Create and Execute Call Sequence
Sequence
  .getInstance()
  .onSuccess(_viewPackages)
  .onError(_error)
  .add({
    'if': {method: _isObjectID, params: [template]},
    'then': {method: _findTemplateByID, params: [template]},
    'else': {method: _findTemplateByCode, params: [template]}
  })
  .add({
    'if': _havePackageTemplate,
    'else': {error: 'Invalid Package Template [' + template + ']'}
  })
  .add({
    label: 'find-stock-point',
    'if': {method: _isObjectID, params: [point]},
    'then': {method: _findStockPointByID, params: [point]},
    'else': {method: _findStockPointByCode, params: [point]}
  })
  .add({
    'if': _haveStockPoint,
    'else': {error: 'Missing Stock Point [' + point + ']'}
  })
  .add({
    label: 'create-packages',
    'if': {method: _gt, params: [qty, 1]},
    'then': {method: _createManyPackages, params: [qty]},
    'else': _createSinglePackage
  })
  .start({
    request: req,
    response: res,
    user: user
  });
...
```

This Basically creates an asynchronous call sequence, with some control structures (if/then/else, loop, goto, Nested Sequences, etc) sprinkled in. If you can live within this structure it should make your code easier to read.

## Basic API

.getInstance() - A wrapper around new. Returns an instance of Sequence that you can then use.

.onSuccess(cb) - Method to call, if the Sequence Completes without Error.

.onError(cb) - Method to call, if an Error Occurs, while processing the Sequence.

.start(context) - Start the Sequence and pass in an optional Context Object.

### Important

1. 'context' has to be a javascript object.
2. If you don't pass in a 'context' object, an empty object '{}' will be used as the context.
3. The 'context' object will serve as the 'this' for all the methods (callbacks) used within the Sequence.

Within a method (callback) used in the Sequence the 'this' will always point to the 'context' object, WHICH,
has been augmented with a series of functions to manage the Sequence's flow.

## 'context' methods

context.next() - Pass Control to the 'next' element in the sequence (method, if/then/else, loop, etc)

context.break() - Break out of a sequence or loop (in a parent sequence, it's more or less equivalent to .end())

context.end() - End the Sequence (break out of any loops nested and sequences)

context.errors() - register's errors in the sequence, and depending on the error settings, will break out of sequence or loop.

## Examples

### Sequence Control structure

```js
...
.add({
  label: 'create-packages',
  'if': {method: _gt, params: [qty, 1]},
  'then': {method: _createManyPackages, params: [qty]},
  'else': _createSinglePackage
})
...
```

Calls the method 'gt', with parameters qty and 1, which tests if the value of qty is greater than one, more or less equivalent to the followin javascript code:

```js
...
_gt(qty,1)
...
```

The actual method:

```js
...
/**
 * Value is Greater than one?
 *
 * @param {number} compare
 * @param {number} value
 * @returns {Boolean}
 */
function _gt(compare, value) {
  return (compare > value) ? this.true() : this.false();
}
...
```

#### Important

1. 'this' === 'context' passed in .start(...)
2. this.true() and this.false() is how the 'gt' method communicates if the test passed or failed.
3. if the test passed - the 'then' clause is 'executed'.
4. if the test passed - the 'else' clause is 'executed'.


### The method called by the 'else' clause (as named above)

```js
...
function _createSinglePackage() {
  // Save Sequence Context
  var context = this;

  // Create a New Sequence to Handle Package Creation
  var child = Sequence.getInstance();

  // Save Parent Sequence and Set New Sequence Base
  var parent = context.sequence(child);

  // Execute Sequence
  child
          .onSuccess(function () {
            context.packages = [this.package];
            context.transactions = [this.transaction];

            // Reset Old Sequence and Continue
            context.sequence(parent);
            context.next();
          })
          .onError(function (errors) {
            // Reset Old Sequence and Continue
            context.sequence(parent);
            context.errors(errors);
          })
          .add(_createPackageFromTemplate)
          .add({
            method: _savePackage,
            'on-error': {error: 'Failed to Create Package'}
          })
          .add(_addPackageToStockPoint)
          .add({
            method: _saveTransaction,
            'on-error': {goto: 'delete-package'}
          })
          .add({goto: 'end'}) // Finish the Sequence
          .add({
            label: 'delete-package',
            method: _deletePackage
          })
          .add({error: 'Failed to Create Package or Transaction'})
          .start(context);
}
...
```

This 'else' clause just basically creates a child sequence and executes it.

### Normal Callback Method

```js
...
function _findStockPointByCode(code) {
  // Save Sequence Context
  var context = this;

  // Find Stock Point by Code
  ERPObject
          .findOneByCode(code)
          .then(function (point) {
            context.stock_point = !_.isNil(point) && point.type[0] === 'S' ? point : null;
            context.async('next');
          })
          .catch(function (err) {
            context.errors(err);
          });
}
...
```

Notice that:

1. on success, context.next() is called.
2. on error, context.errors() is called.
3. we save the value of 'point' as member of 'context' so that it can be used in other callbacks.
