## Templates

How do templates work?

If you used this module in any of your projects, you will eventually get to the point that you start repeating a set of sequence entries in the code (atleast I did).

Obviously it would be nice to, instead of doing copy-paste of these group of entries, you could just simple add a single entry, that would expand, in-place.

For that I created reason I added templates.

Again, to simplify the explanation, I'm going to use a code example from my project.

A template is:

1. just basically a method call.
2. The method is called, as part of the sequence creation process.
3. Inside the template, you can then add any other entries you need (i.e. the expansion).

NOTE: The template method, is not part of the executable sequence, it's just a placeholder for other entries.

Code Example: Find a User by Name or ID

```
...

// Default Options (and values) for Template Find
var _templateFindDefaults = {
  firm: null,                      // Limit Search to a Specific Firm
  collection: "objects",           // Mongo Collection
  dname: "user",               // Context Destination Property
  required: true,                  // Result Value Required?
  error: "User does not exist" // Default Error Message
};

...

templateFind: function(user, options) {
  // Initialize Options
  options = helpers.isSimpleObject(options) ?
    _.merge({}, _templateFindDefaults, options) : _templateFindDefaults;

  /* Find User by Name or ID */
  this
    .add({method: adMongo.connectToCollection, params: options.collection })
    .add({
      "if": {method: adMongo.isMongoID, params: user},
      "then": {method: module.exports.findByID, params: [user, options.dname]},
      "else": {method: module.exports.findByUserName, params: [user, options.dname]}
    });

  // Is the USER Required?
  if (options.required) {
    this.add({method: adContext.assertPropertyNotNull, params: [options.dname, options.error]});
  }

  return this;
}

...

update: function(req, res, next) {
  try {
    // Make sure we have a Valid Session
    adSession.start(req);

    ...

    console.log("Update User");
    Sequence
      .getInstance()
      ...
      /* Find User */
      .template({method: adUser.templateFind, params: user})
      ...
      .start({
        request: req,
        response: res,
        rnext: next
      });
    } catch (e) {
      return responses.error(req, res, next, e);
    }
  },
```

As you can see, .template(...) basically behaves like .add(...).

You can:
1. Pass in parameters to template method
2. Assign a 'label' to the template entry

If you assign a 'label' to the template entry, the label, will be assigned to the
first entry ADDED by the template. This "allows you" to goto a template.
