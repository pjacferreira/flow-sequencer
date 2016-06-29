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

1. Pass in parameters to the template method
2. Assign a 'label' to the template entry

If you assign a 'label' to the template entry, the label, will be transferred to the
first entry ADDED by the template. This "allows you" to "goto" **the start** of the template.

## Method Calls

One of the most basic uses of Flow Sequencer is to call functions in a Specific
order. To do that, you just simply use the flow-sequencer add method.

```
// Include Module
var Sequence = require("flow-sequencer");
...

// Create Sequence
Sequence
  .getInstance()
  ...
  // Add Method Call
  .add(callThisMethod)
  ...
  .start()

```

You have 2 options when using add():

1. Pass it a function reference.
2. Pass it a valid flow sequencer entry object.

In the example we are just simply passing it a function reference, which the
add() will automatically convert to a valid method call entry which will be used
during sequence processing.

Below is an example of a full (all the options) flow sequencer method call entry.

```
var method_call_entry = {
  label:  "label for goto jump destination",
  method: functionReference,
  params: [ of, parameters, to, pass, to, functionReference],
  goto:   "label to jump to if the function completes without error"
};
```

Through the use of very liberal property values, I hope the entry's properties have
been basically explained, but I would still like to point out 3 things:

1. functionReference is called within the sequence context.

**VERY IMPORTANT**
sequence context !== *Sequence.getInstance()*. The sequence context, is the
object, passed to *Sequence.start({})*, which is augmented with some functions (i.e.
*next*, *break*, *errors*, *end*, etc) that allow you to sequentially process the sequence.

**ALSO VERY IMPORTANT**
all properties in the sequence context, are available to functionReference, as part of
the functions *this* properties.

If you want to pass values between differente sequence entries, you can use context
parameters, as long as you remember that you can't OVERWRITE the SPECIAL FUNCTIONS
(*next*, *break*, *errors*, *end*, etc) that have been added to sequence context, by flow-sequencer.

2. *params* is an array value, but, you can still pass it a non array value, it
will just simply be assume that your function only accepts a single parameter value.
Internally (after cleanup but before being executed), *params* that are passed as
non array values, will be converted to an array with a single value.

So, the following is also valid:

```
var entry = {
  ...
  params: only_one_parameter,
  ...
};
```

3. As a special HACK I have added the *goto* property to the method entry.
Basically this allows you to convert the following scenario:

```
// Include Module
var Sequence = require("flow-sequencer");
...

// Create Sequence
Sequence
  .getInstance()
  ...
  .add(callThisMethod)  // Call method
  .add({goto: "end"})   // End the Sequence
  ...
  .start()

```

into:

```
// Include Module
var Sequence = require("flow-sequencer");
...

// Create Sequence
Sequence
  .getInstance()
  ...
  // Call Method and, if it doesn't throw an error, end the sequence
  .add({
    method: callThisMethod,
    goto:   "end"
  })  // Call method
  ...
  .start()

```

It's basically syntactic sugar.

## IF/THEN/ELSE Entries

IF/THEN/ELSE is a simple control structure. The most complete entry format is:

```
var method_call_entry = {
  label: "label for goto jump destination",
  if:    basic_method_call_entry
  then:  then_any_valid_sequence_entry
  else:  else_any_valid_sequence_entry
};
```

So what are the **gotchas**?

Well:

1. *basic_method_call_entry* is the same as normal method call entry (above) with
two exceptions:
  * it can't have a *label* and *goto* (i.e. you can't jump into the middle of an if or out of it)
  * instead of calling *this.next()* or *this.break()* to continue the sequence, it should call *this.true()* or *this.false()*.
  * Basically, if *this.true()* is called the *then* entry is executed, if *this.false()* is called the else entry is executed.
2. then/else sequence entries can literally be any valid sequence entry, with the only limitation being that they can't have a *label* (i.e. the same concept as above, you can't jump into the middle of an *if*).
3. What if I don't want to handle the **false** case (i.e. I don't want the *else* entry)? Simply Don't include it (same applies if you don't want the *then* clause). If the sequence sees the *else* is missing it will just continue processing with the next entry after the *if*.

The very minimum if/then/else entry requires the *if* and one of *then*/*else* (but not both).
