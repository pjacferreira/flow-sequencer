/* Copyright (C) 2016 Paulo Ferreira <pf@sourcenotes.org> */
var _ = require("lodash");

/* HELPER METHODS */
function _nullOnEmpty(str) {
  str = _.isString(str) ? str.trim() : null;
  return (str !== null) && (str.length > 0) ? str : null;
}

function _isSimpleObject(obj) {
  return !_.isNil(obj) && (typeof obj === "object");
}

function _isSequence(entry) {
  return _isSimpleObject(entry) && (entry instanceof Sequence);
}

function _appendToArray(array, values) {
  if (!_.isNil(values)) {
    if (_.isNil(array)) {
      array = _.isArray(values) ? values : [values];
    } else if (_.isArray(values)) {
      array = array.concat(values);
    } else {
      array.push(values);
    }
  }

  return array;
}

function _wrappedCall(context, f, args) {
  // Is the Wrapped Function Being Called with Parameters?
  if (_.isNil(args) || !_.isArray(args) || (args.length === 0)) { // NO
    return f.call(context);
  } else { // YES
    return f.apply(context, args);
  }
}

function _isMethodCall(entry) {
  return _.isObject(entry) && entry.hasOwnProperty("method");
}

function _callMethod(context, entry) {
  return _wrappedCall(context, entry.method, entry.hasOwnProperty("params") ? entry.params : null);
}

function __cleanParamsProperty(entry) {
  var params = null;
  if (entry.hasOwnProperty("params")) {
    params = entry["params"];
    params = _.isArray(params) ? (params.length ? params : null) : [params];
  }
  return params;
}

function __cleanLabelProperty(entry, top) {
  // Get Basis for Entry Label
  var label = !top ?
              null :
              (entry.hasOwnProperty("label") ? entry["label"] : null);

  // Do we have a Label Set?
  if (label !== null) { // YES: Trim and Clean
    label = _nullOnEmpty(label);
  }

  // Return Label for Entry
  return label;
}

function __cleanGotoProperty(entry, top) {
  // Get Basis for Entry Label
  var goto = entry.hasOwnProperty("goto") ? entry["goto"] : null;

  // Do we have a Goto Set?
  if (goto !== null) { // YES: Clean it Up
    // Is the 'goto' value a string?
    if (_.isString(goto)) { // YES: Clean it
      goto = _nullOnEmpty(goto);
    } else
    // Is the 'goto' a function?
    if (_.isFunction(goto) || _isSimpleObject(goto)) { // YES: Handle it as a Method Entry
      goto = _cleanMethod(goto, false);
    } else { // ELSE: Invalid Value ignore it
      goto = null;
      console.error("Invalid value for entry 'goto'");
    }
  }

  // Return 'goto' for Entry
  return goto;
}

function _cleanError(entry, top) {
  // Cleanup Incoming Parameters
  top = !!top;

  // Is 'entry' an Object?
  if (_isSimpleObject(entry)) { // YES

    // Is the error's value a non empty string or a function?
    var error = entry.hasOwnProperty("error") ? entry["error"] : null;
    error = _.isString(error) ?
            _nullOnEmpty(error) :
            _cleanMethod(error, false);
    if (error !== null) { // YES
      // Cleanup Properties
      var label = __cleanLabelProperty(entry, top);
      var goto = __cleanGotoProperty(entry, false);
      var doBreak = entry.hasOwnProperty("do-break") ? !!entry["do-break"] : true;

      // Do we have a 'goto' or an 'error method'?
      if ((goto !== null) || _isSimpleObject(error)) { // YES
        doBreak = false;
      }

      // Return Clean Entry
      return {
        "label": label,
        "error": error,
        "goto": goto,
        "do-break": doBreak
      };
    }
  }

  console.error("Invalid 'error' Entry.");
  return null;
}

function _cleanGoto(entry, top) {
  // Cleanup Incoming Parameters
  top = !!top;

  // Is the error's value a non empty string or a function?
  var jump = __cleanGotoProperty(entry, false);
  if (jump !== null) { // YES
    // Cleanup Properties
    var label = __cleanLabelProperty(entry, top);

    // Return Clean Entry
    return {
      "label": label,
      "goto": jump
    };
  }

  console.error("Invalid 'goto' Entry.");
  return null;
}

function _cleanMethod(entry, top) {
  // Cleanup Incoming Parameters
  top = !!top;

  // Is it a function?
  if (_.isFunction(entry)) { // YES: Convert it to a Method Entry
    return {
      "label": null,
      "method": entry,
      "params": null,
      "goto": null
    };
  }

  // Is 'entry' an Object?
  if (_isSimpleObject(entry)) { // YES: Treat it as a Second Level Method Entry
    // Clean Method Property
    var method = null;
    if (entry.hasOwnProperty("method")) {
      method = _.isFunction(entry["method"]) ? entry["method"] : null;
    }

    // Do we have a valid 'method' Property?
    if (method !== null) { // YES
      // Cleanup Properties
      var label = __cleanLabelProperty(entry, top);
      var jump = __cleanGotoProperty(entry, false);
      var params = __cleanParamsProperty(entry);

      // Return Clean Entry
      return {
        "label": label,
        "method": method,
        "params": params,
        "goto": jump
      };
    }
  }

  console.error("Invalid Method Entry.");
  return null;
}

function _cleanSequence(entry, top) {
  // Cleanup Incoming Parameters
  top = !!top;

  // Is it a Sequence Instance?
  if (_isSequence(entry)) { // YES: Convert it to a Senquence Entry
    return {
      "label": null,
      "sequence": entry,
      "goto": null
    };
  }

  if (_isSimpleObject(entry)) { // YES: Treat it as a Second Level Method Entry
    // Clean Method Property
    var sequence = null;
    if (entry.hasOwnProperty("sequence")) {
      sequence = _isSequence(entry["sequence"]) ? entry["sequence"] : null;
    }

    if (sequence !== null) {
      // Cleanup Properties
      var label = __cleanLabelProperty(entry, top);
      var goto = __cleanGotoProperty(entry, false);

      // Return Clean Entry
      return {
        "label": label,
        "sequence": sequence,
        "goto": goto
      };
    }
  }

  console.error("Invalid Sequence Entry.");
  return null;
}

function _cleanIf(entry, top) {
  // Cleanup Incoming Parameters
  top = !!top;

  // Do we have a valid 'if' condition clause?
  var entryIF = _cleanMethod(entry["if"], false);
  if (entryIF !== null) { // YES

    // Does the 'if' conditional method have a 'goto'?
    if (entryIF.goto !== null) { // YES: Warn and Clear it
      console.warn("IF conditional method entry can not have 'goto' set");
      entryIF["goto"] = null;
    }

    // Cleanup Properties
    var label = __cleanLabelProperty(entry, top);
    var entryTHEN = entry.hasOwnProperty("then") ? _cleanEntry(entry["then"], false) : null;
    var entryELSE = entry.hasOwnProperty("else") ? _cleanEntry(entry["else"], false) : null;

    // Do we have (At least) ONE OF 'then'/'else'
    if ((entryTHEN !== null) || (entryELSE !== null)) { // YES: Okay Continue
      return {
        "label": label,
        "if": entryIF,
        "then": entryTHEN,
        "else": entryELSE,
        "goto": null // To Make Entry Processing Easier....
      };
    }

    console.error("'else'/'then' cannot both be missing or invalid");
  } else {
    console.error("'if' conditional clause is missing or invalid");
  }

  return null;
}

function _cleanLoop(entry, top) {
  // Loop Conditional Clause
  var control = entry["loop"];
  if (_.isBoolean(control)) {
    control === true ? true : null;
  } else {
    control = _cleanMethod(control, false);

    // Does the 'loop' conditional method have a 'goto'?
    if (control.goto !== null) { // YES: Warn and Clear it
      console.warn("LOOP conditional method entry can not have 'goto' set");
      control["goto"] = null;
    }
  }

  // Do we have a Valid Conditional Clause?
  if (control !== null) { // YES
    console.error("Loop missing valid conditional entry");
    return null;
  }

  // Do we have Valid Loop Block
  var block = null;
  if (entry.hasOwnProperty("block")) {
    block = _cleanEntry(entry["block"]);
    if (block.hasOwnProperty("error")) {
      console.error("a LOOP block cannot be an 'error' entry");
      block = null;
    } else if (block.hasOwnProperty("goto")) {
      if (!(block.hasOwnProperty("method") ||
            block.hasOwnProperty("loop") ||
            block.hasOwnProperty("sequence") ||
            block.hasOwnProperty("if"))
         ) {
        console.error("a LOOP block cannot be an 'goto' entry");
        block = null;
      }
    }
  }

  if (block === null) {
    console.error("Loop missing valid block entry");
    return null;
  }

  // Does the 'block' entry have a 'goto'?
  if (block.goto !== null) { // YES: Warn and Clear it
    console.warn("LOOP block entry can not have 'goto' set");
    control["goto"] = null;
  }

  // Is the Block a Sequence?
  if (!block.hasOwnProperty("sequence")) { // NO: Convert to a Sequence
    /* NOTE: This is a HACK to simplify loop handling (i.e. we make sure)
     * that all loop 'blocks' are sequences
     */

    // TODO: Optimize Processing for Single Entry Loop 'block's
    var sequence = Sequence.getInstance().add(block);
    block = {
      "label": null,
      "sequence": sequence,
      "goto": null
    };
  }

  // Cleanup Properties
  var label = __cleanLabelProperty(entry, top);
  var goto = __cleanGotoProperty(entry, false);

  // Cleanup 'on-success'
  var onSuccess = entry.hasOwnProperty("on-success") ?
                  _cleanEntry(entry["on-success"]) : null;

  // Cleanup 'on-error'
  var onError = entry.hasOwnProperty("on-error") ? entry["on-error"] : null;
  if (!_.isBoolean(onError)) {
    onError = onError !== null ? _cleanEntry(onError) : null;
  }

  return {
    "label": label,
    "loop": control,
    "block": block,
    "on-success": onSuccess,
    "on-error": onError,
    "goto": goto
  };
}

function _cleanEntry(entry, top) {
  if (!_.isNil(entry)) {
    if (_.isFunction(entry)) {
      return _cleanMethod(entry, top);
    } else if (_isSequence(entry)) {
      return _cleanSequence(entry, top);
    } else if (_isSimpleObject(entry)) {
      if (entry.hasOwnProperty("error")) { // YES: Clean it up
        return _cleanError(entry, top);
      }
      if (entry.hasOwnProperty("sequence")) { // YES: Clean it up
        return _cleanSequence(entry, top);
      }
      if (entry.hasOwnProperty("method")) { // YES: Clean it up
        return _cleanMethod(entry, top);
      }
      if (entry.hasOwnProperty("if")) { // YES: Clean it up
        return _cleanIf(entry, top);
      }
      if (entry.hasOwnProperty("loop")) { // YES: Clean it up
        return _cleanLoop(entry, top);
      }
      if (entry.hasOwnProperty("goto")) { // YES: Clean it up
        return _cleanGoto(entry, top);
      }
    }

    console.error("Invalid Entry Type.");
    entry = null;
  }

  return entry;
}

/* RULES:
 * function starting with _ are functions that are only callable from within the
 * sequence context (i.e. methods that make up part of the sequence steps)
 * functions starting with __ are private functions that are only callable from
 * within sequence methods (No Parameter Validation is done, the values are
 * expected to be correct)
 */
function Sequence(parent) {
  // Reference to Parent Sequence
  this.__parent = parent;

  // Control Flags
  this.__breakOnErrors = true;

  // Success / Error Handlers
  this.__onSuccess = null;
  this.__onError = null;

  // Process Control
  this.__calls = [];
  this.__stack = [];
  this.__labels = {};
}

/**
 *
 * @param {type} parent
 * @returns {nm$_sequence.Sequence}
 */
Sequence.getInstance = function(parent) {
  return new Sequence(_isSequence(parent) ? parent : null);
};

Sequence.prototype.reset = function(parent) {
  // Errors List
  this.__errorsList = null;

  // Sequence Context
  this.__context = null;

  // Loop Control
  this.__loopErrors = null;
  this.__loopRun = false;

  return this;
};

Sequence.prototype.setParent = function(parent) {
  this.__parent = _isSequence(parent) ? parent : null;
  return this;
};

Sequence.prototype.isRootSequence = function(parent) {
  return _.isNil(this.__parent);
};

Sequence.prototype.breakOnError = function() {
  return this.__breakOnErrors;
};

Sequence.prototype.setBreakOnError = function(flag) {
  this.__breakOnErrors = !!flag;
  return this;
};

Sequence.prototype.onSuccess = function(success) {
  this.__onSuccess = _.isFunction(success) ? success : null;
  return this;
};

Sequence.prototype.onError = function(error) {
  this.__onError = _.isFunction(error) ? error : null;
  return this;
};

Sequence.prototype.add = function(entry) {
  // Is the Entry Valid?
  var newEntry = _cleanEntry(entry, true);
  if (_.isNil(newEntry)) { // NO: Log Error
    console.error("Attempt to Introduce Invalid Entry");
  } else { // YES: Add Entry
    var label = newEntry.label;
    if (!_.isNil(label)) {
      this.__labels[label] = this.__calls.length;
    }
    this.__calls.push(newEntry);
  }

  return this;
};

Sequence.prototype.hasErrors = function() {
  return this.__errorsList !== null;
};

Sequence.prototype.getErrors = function() {
  return this.__errorsList !== null ? this.__errorsList : [];
};

Sequence.prototype.start = function(context) {
  if (_.isNil(context)) {
    context = {
      __initialized: false
    };
  }

  if (!context.__initialized) {
    // Initialize the Context
    context = _.merge({
      sequence: function(set) {
        if (_.isNil(set) || !(set instanceof Sequence)) {
          return this.__sequence;
        } else {
          var old = this.__sequence;
          this.__sequence = set;
          return old;
        }
      },
      errors: function(err) {
        return this.__sequence._errors(err, true);
      },
      goto: function(label) {
        return this.__sequence._goto(label);
      },
      end: function() {
        return this.__sequence._end();
      },
      next: function() {
        return this.__sequence._next();
      },
      break: function() { // Stop the Loop
        return this.__sequence._break();
      },
      continue: function() { // Continue the Loop
        return this.__sequence._continue();
      },
      "true": function() { // Continue the Loop
        return this.__sequence._true();
      },
      "false": function() { // Continue the Loop
        return this.__sequence._false();
      },
      async: function(call) {
        if (this.hasOwnProperty(call) && _.isFunction(this[call])) {
          var saveThis = this;
          setTimeout(function() {
            saveThis[call]();
          }, 0);
        };
      }
    }, context);

    // Mark Context as Initialized
    context.__initialized = true;
  }

  // Initialize Context Sequence
  context.sequence(this);

  try {
    // Errors List
    this.__errorsList = null;

    // Loop Control
    this.__loopErrors = null;
    this.__loopRun = false;

    // Initialize Sequence
    this.__finished = false;
    this.__current = 0;
    this.__stack = [];

    // Sequence Context
    this.__context = context;

    // Start the Sequence
    this.__next();
  } catch (e) {
    this.__errorsList = _appendToArray(this.__errorsList, e);
    this.__end();
  }

  return this;
};

Sequence.prototype._goto = function(label) {
  // Is this sequence finished?
  if (this.__finished) { // YES: Ignore Call
    throw "SEQUENCE: Called 'goto' after sequence completed.";
  }

  // Is Possible Valid Label?
  label = _nullOnEmpty(label);
  if (_.isNil(label)) { // NO
    throw "Missing or Invalid Goto Label";
  }

  return this.__goto(label);
};

Sequence.prototype.__goto = function(label) {
  // All Labels are Lower Case
  label = label.toLowerCase();

  // Do we want to exit, this and any parent sequences,
  switch (label) {
    case "continue": // We want to RESTART Loop
      return this.__continue();
    case "break": // We want to END Current Sequence
      return this.__break();
    case "end": // We want to END Everything
      return this.__end();
  }

  // Does the Label Exist?
  if (!this.__labels.hasOwnProperty(label)) { // NO
    throw "Missing Goto Label [" + label + "]";
  }

  // Reposition the Current Entry to the 'label' and process it.
  this.__current = this.__labels[label];
  return this.__processEntry(this.__calls[this.__current++]);
};

Sequence.prototype._break = function() {
  // Is this sequence finished?
  if (this.__finished) { // YES: Ignore Call
    // DO NOTHING (Allows for Callstack to unroll, in deeply nested call)
    return this;
  }

  // Take a look at what is at the top of the stack
  var top = this.__peekTopStack();

  // Was an 'if' at the top of stack?
  if (top.hasOwnProperty("if") || top.hasOwnProperty("loop")) { // YES
    // Do 'false' processing
    return this.__false();
  }

  return this.__break();
};

Sequence.prototype.__break = function() {
  // Pop element Off Stack
  var top = this.__stack.pop();

  // Is this the 'root' sequence?
  if (this.isRootSequence()) { // YES: Then just end it
    return this.__end();
  }

  // Are we with an Loop Block
  if (this.__isLoopBlock()) { // YES: Break the Loop
    // Reset Context to Point to Correct Sequence
    this.__context.sequence(this.__parent);
    return this.__parent.__exitLoopBlock("break", this.__errorsList);
  }
  // ELSE: Break Parent Sequence
  this.__finished = true;
  return this.__parentBreak();
};

Sequence.prototype.__parentBreak = function() {
  // Reset Context to Point to Correct Sequence
  this.__context.sequence(this.__parent);

  // Did we have errors in the processing of this sequence?
  if (this.__errorsList !== null) { // YES
    return this.__parent.__errors(this.__errorsList);
  }
  // ELSE: Break Parent Processing
  return this.__parent.__break();
};

Sequence.prototype._next = function() {
  // Is this sequence finished?
  if (this.__finished) { // YES: Ignore Call
    // DO NOTHING (Allows for Callstack to unroll, in deeply nested call)
    return this;
  }

  return this.__next();
};

Sequence.prototype.__next = function() {
  // Pop element Off Stack
  var top = this.__stack.pop();

  // Does the Entry have a 'goto' associated?
  if (!_.isNil(top) && (top["goto"] !== null)) { // YES: Continue from that point
    return this.__goto(top["goto"]);
  }

  if (this.__current < this.__calls.length) {
    return this.__processEntry(this.__calls[this.__current++]);
  }

  // Is this the 'root' sequence?
  if (this.isRootSequence()) { // YES: Then just end it
    return this.__end();
  }
  // ELSE: Continue the 'parent' Sequence
  this.__finished = true;
  return this.__parentNext();
};

Sequence.prototype.__parentNext = function() {
  // Reset Context to Point to Correct Sequence
  this.__context.sequence(this.__parent);

  // Did we have errors in the processing of this sequence?
  if (this.__errorsList !== null) { // YES
    return this.__parent.__errors(this.__errorsList);
  }
  // ELSE: Continue Processing Parent
  return this.__parent.__next();
};

Sequence.prototype._errors = function(errors, doBreak) {
  // Is this sequence finished?
  if (this.__finished) { // YES: Ignore Call
    console.error(errors);
    // DO NOTHING (Allows for Callstack to unroll, in deeply nested call)
    return this;
  }

  return this.__errors(errors, doBreak);
};

Sequence.prototype.__errors = function(errors, doBreak) {
  // Append Errors to Current Sequence array
  this.__errorsList = _appendToArray(this.__errorsList, errors);

  // Do we need to Break on this error?
  if (!doBreak || !this.breakOnError()) { // NO: Continue Sequence Processing
    return this.__next();
  }

  return this.__break();
};

Sequence.prototype._end = function() {
  // Is this sequence finished?
  if (this.__finished) { // YES: Ignore Call
    // DO NOTHING (Allows for Callstack to unroll, in deeply nested call)
    return this;
  }

  return this.__end();
};

Sequence.prototype.__end = function() {
  // Mark Sequence Finished
  this.__finished = true;

  // Is this a Child Sequence?
  if (!this.isRootSequence()) { // YES: Call the Parent Context's 'end'
    return this.__parentEnd();
  }

  // Did the run generate errors?
  if (this.__errorsList !== null) { // YES: Call Error Handler (if it exists)
    // Call the Error Handler for the Sequence
    return this.__onError !== null ?
           _wrappedCall(this.__context, this.__onError, this.__errorsList) : false;
  } else { // NO: Call the Success Handler for the Sequence (if it exists)
    return this.__onSuccess !== null ?
           _wrappedCall(this.__context, this.__onSuccess) : false;
  }
};

Sequence.prototype.__parentEnd = function() {
  // Reset Context to Point to Correct Sequence
  this.__context.sequence(this.__parent);

  // Did we have errors in the processing of this sequence?
  if (this.__errorsList !== null) { // YES: Append Errors to Parents Error List
    this.__parent.__errorsList = _appendToArray(this.__parent.__errorsList, this.__errorsList);
  }

  // Call Parent Sequence to End
  return this.__parent.__end();
};

Sequence.prototype._true = function() {
  // Is this sequence finished?
  if (this.__finished) { // YES: Ignore Call
    throw "SEQUENCE: Called 'true' after sequence completed.";
  }

  // Take a look at what is at the top of the stack
  var top = this.__peekTopStack();

  // Do we have a valid context?
  if (top === null) { // NO
    throw "SEQUENCE: 'true' called from invalid context";
  }

  // Are we dealing with a 'if' or 'loop' condition clause?
  if (top.hasOwnProperty("if") || top.hasOwnProperty("loop")) { // YES
    // Call 'true' handling
    return this.__true();
  }
  // ELSE: Treat as Simple 'next'
  return this.__next();
};

Sequence.prototype.__true = function() {
  var top = this.__stack.pop();

  // Is the Top of the Stack a Loop entry?
  if (top.hasOwnProperty("loop")) { // YES: continue called from Loop Check Function
    // Replace the LOOP back on the stack
    this.__stack.push(top);

    // (Re)Execute Loop Block
    var block = top["block"];
    this.__loopRun = true;
    return this.__processSequence(block);
  }

  // Was an 'if' at the top of stack?
  if (top.hasOwnProperty("if")) { // YES
    // Does the 'if' have an 'then' clause?
    if (!_.isNil(top["then"])) { // YES: Execute it
      return this.__processEntry(top["then"]);
    }
    // ELSE: Continue the Sequence
    return this.__next();
  }

  // Should not be able to reach this point
  throw "System Error";
};

Sequence.prototype._false = function() {
  // Is this sequence finished?
  if (this.__finished) { // YES: Ignore Call
    throw "SEQUENCE: Called 'false' after sequence completed.";
  }

  // Take a look at what is at the top of the stack
  var top = this.__peekTopStack();

  // Do we have a valid context?
  if (top === null) { // NO
    throw "SEQUENCE: 'false' called from invalid context";
  }

  // Are we dealing with a 'if' or 'loop' condition clause?
  if (top.hasOwnProperty("if") || top.hasOwnProperty("loop")) { // YES
    // Call 'false' handling
    return this.__false();
  }
  // ELSE: Treat as Simple 'break'
  return this.__break();
};

Sequence.prototype.__false = function() {
  var top = this.__stack.pop();

  // Is the Top of the Stack a Loop entry?
  if (top.hasOwnProperty("loop")) { // YES
    // Replace the 'loop' entry back on the stack
    this.__stack.push(loop);

    // End the Loop
    return this.__exitLoop("end", null);
  }

  // Was an 'if' at the top of stack?
  if (top.hasOwnProperty("if")) { // YES
    // Does the 'if' have an 'else' clause?
    if (!_.isNil(top["else"])) { // YES: Execute it
      return this.__processEntry(top["else"]);
    }
    // ELSE: Continue the Sequence
    return this.__next();
  }

  // Should not be able to reach this point
  throw "System Error";
};

Sequence.prototype._continue = function() {
  // Is this sequence finished?
  if (this.__finished) { // YES: Ignore Call
    throw "SEQUENCE: Called 'continue' after sequence completed.";
  }

  // Take a look at what is at the top of the stack
  var top = this.__peekTopStack();

  // Do we have a valid context?
  if (top === null) { // NO
    throw "SEQUENCE: 'continue' called from invalid context";
  }

  // Are we dealing with a 'if' or 'loop' condition clause?
  if (top.hasOwnProperty("if") || top.hasOwnProperty("loop")) { // YES
    // Call 'true' handling
    return this.__true();
  }

  // Are we within a Loop Block?
  if (this.__isLoopBlock()) { // YES: Restart Loop
    // Reset Context to Point to Correct Sequence
    this.__context.sequence(this.__parent);
    return this.__parent.__exitLoop("continue", this.__errorsList);
  }
  // ELSE: Treat as Simple 'next'
  return this.__next();
};

Sequence.prototype.__exitLoop = function(code, errors) {
  var loop = null;
  switch (code) {
    case "continue":
      // Save Error Codes for Later
      this.__loopErrors = _appendToArray(this.__loopErrors, errors);
      // Get the Currently Executing Loop
      loop = this.__peekTopStack();

      // Re-Execute Check Function
      var check = entry["loop"];
      return _.isBoolean(check) ?
             this.__executeBlock(entry["block"]) : this.__processMethod(check);
    case "break":
      // Save Error Codes for Later
      this.__loopErrors = _appendToArray(this.__loopErrors, errors);
    case "end":
      // Get the Currently Executing Loop
      var loop = this.__stack.pop();

      // Does the loop's sequence 'block' have errors?
      if (this.__loopErrors === null) { // NO
        // Do we have an succes handler to execute?
        if (loop.hasOwnProperty("on-success")) {
          return this._processEntry(loop["on-success"]);
        }
        // ELSE: NO - Simple Continue Sequence Execution
        return this.__next();
      } else { // YES
        // Do we have an error handler to execute?
        if (loop.hasOwnProperty("on-error")) { // YES: Execute it
          return this._processEntry(loop["on-error"]);
        }
        // ELSE: NO - Use normal error handling
        return this.__errors(this.__loopErrors, true);
      }
  }
};

/* ENTRY PROCESSING */
Sequence.prototype.__processError = function(entry) {
  var error = entry["error"];

  // Is the 'error' value a string?
  if (_.isString(error)) { // YES: Do Normal Processing
    var doBreak = entry["do-break"];
    this.__errors(error, doBreak);
  } else { // NO: Call Error Method
    /* NOTE: the 'error method' is not put on the stack, so a call to
     * next() / break() will only see the error entry
     */
    return this.__processMethod(error);
  }
};

Sequence.prototype.__processIF = function(entry) {
  return this.__processMethod(entry["if"]);
};

Sequence.prototype.__processLOOP = function(entry) {
  // Reset loop state control
  this.__loopErrors = [];
  this.__loopRun = false;

  // Execute Check Function
  var check = entry["loop"];
  return _.isBoolean(check) ?
         this.__processSequence(entry["block"]) : this.__processMethod(check);
};

Sequence.prototype.__processMethod = function(entry) {
  return _wrappedCall(this.__context,
                      entry.method,
                      entry.hasOwnProperty("params") ? entry.params : null);
};

Sequence.prototype.__processSequence = function(entry) {
  // Get the Sequence to Execute
  var sequence = entry["sequence"];

  // Execute the Sequence
  return sequence
    .setParent(this) // Set the Parent
    .start(this.__context);
};

Sequence.prototype.__processGoto = function(entry) {
  this.__stack.pop();
  return this.__goto(entry["goto"]);
};

Sequence.prototype.__processEntry = function(entry) {
  // Save Current Entry on the Stack
  this.__stack.push(entry);

  // Is the Entry a Error Statement?
  if (entry.hasOwnProperty("error")) { // YES
    return this.__processError(entry);
  }

  // Is the Entry an If Statement?
  if (entry.hasOwnProperty("if")) { // YES
    return this.__processIF(entry);
  }

  // Is the Entry a Loop Statement?
  if (entry.hasOwnProperty("loop")) { // YES
    return this.__processLOOP(entry);
  }

  // Is the Entry a Call Method Statement?
  if (entry.hasOwnProperty("method")) { // YES
    return this.__processMethod(entry);
  }

  // Is the Entry a Sequence Statement?
  if (entry.hasOwnProperty("sequence")) { // YES
    return this.__processSequence(entry);
  }

  // Is the Entry a Call Method Statement?
  if (entry.hasOwnProperty("goto")) { // YES
    return this.__processGoto(entry);
  }

  // Invalid Method Entry
  console.error(entry);
  throw "Invalid Sequence Entry";
};

/* HELPER METHODS */
Sequence.prototype.__peekTopStack = function() {
  // Peek at the stack
  return this.__stack.length ?  this.__stack[this.__stack.length - 1] : null;
};

Sequence.prototype.__isLoopBlock = function() {
  var topParent = this.__parent.__peekTopStack();
  return (topParent !== null) && topParent.hasOwnProperty("loop");
};

// Export Constructor
module.exports = Sequence;
