/* Copyright (C) 2016 Paulo Ferreira <pf@sourcenotes.org> */
var _ = require("lodash");

/* HELPER METHODS */
function _nullOnEmpty(str) {
  str = _.isString(str) ? str.trim() : null;
  return (str !== null) && (str.length > 0) ? str : null;
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

function _isSequence(entry) {
  return _.isObject(entry) && (entry instanceof Sequence);
}

function _isMethodCall(entry) {
  return _.isObject(entry) && entry.hasOwnProperty("method");
}

function _callMethod(context, entry) {
  return _wrappedCall(context, entry.method, entry.hasOwnProperty("params") ? entry.params : null);
}
function _cleanupLabel(label) {
  label = _nullOnEmpty(label);
  return (label !== null) ? label.toLowerCase() : null;
}

function _cleanupMethodParameters(params) {
  return _.isNil(params) || _.isArray(params) ? params : [params];
}

function _cleanupMethodDefinition(entry) {
  var o = null;

  if (_.isFunction(entry)) {
    o = {
      "label": null,
      "method": entry,
      "params": null
    };
  } else if (_.isString(entry)) {
    entry = _nullOnEmpty(entry);
    if ((entry !== null) && _.isFunction(global[entry])) {
      o = {
        "label": null,
        "method": global[entry],
        "params": null
      };
    }
  } else if (_.isObject(entry)) {
    if (entry.hasOwnProperty("method")) {
      o = _cleanupMethodDefinition(entry.method);
      if (o !== null) {
        o.label = entry.hasOwnProperty("label") ? _cleanupLabel(entry.label) : null;
        o.params = entry.hasOwnProperty("params") ? _cleanupMethodParameters(entry.params) : null;
      }
    }
  }

  return o;
}

function _cleanupGoToEntry(entry) {
  var goto = entry.goto;

  // Is the goto's value a non empty string or a function?
  goto = _.isString(goto) ?
          _nullOnEmpty(goto) :
          (_.isFunction(goto) ? goto : null);
  if (goto !== null) { // YES
    return {
      "label": null,
      "goto": goto
    };
  }

  return null;
}

function _cleanupErrorEntry(entry) {
  var error = entry.error;

  // Is the error's value a non empty string or a function?
  error = _.isString(error) ?
          _nullOnEmpty(error) :
          (_.isFunction(error) ? error : null);
  if (error !== null) { // YES
    return {
      "label": null,
      "error": error
    };
  }

  return null;
}

function _cleanupIfEntry(entry) {
  /* IF DEFINITION :=
   * 'method_call_definition' := {
   *   'method' ':' (function | function_by_name)
   *   'params' ':' parameter
   *   '}'
   * 'method_call' := method_definition |
   *                  function_by_name (string) |
   *                  function (reference)
   *
   * 'if' := method_call                  -- Condition Clause
   * [OPTIONAL] 'then' := sequence_entry  -- Executed if Condition Clause is call this.true()
   * [OPTIONAL] 'else' := sequence_entry  -- Executed if Condition Clause is call this.false()
   */
  var entryIF = _cleanupMethodDefinition(entry["if"]);

  if (entryIF !== null) {
    var entryTHEN = entry.hasOwnProperty("then") ? _cleanupEntry(entry["then"]) : null;
    var entryELSE = entry.hasOwnProperty("else") ? _cleanupEntry(entry["else"]) : null;
    if ((entryTHEN !== null) || (entryELSE !== null)) {
      return {
        "label": entry.label,
        "if": entryIF,
        "then": entryTHEN,
        "else": entryELSE
      };
    }
  }

  return null;
}

function _cleanupLoopEntry(entry) {
  /* LOOP DEFINTION :=
   * 'method_call_definition' := {
   *   'method' ':' (function | function_by_name)
   *   'params' ':' parameter
   *   '}'
   * 'method_call' := method_definition |
   *                  function_by_name (string) |
   *                  function (reference)
   *
   * 'loop' := 'true' |                         -- Infinite Loop : Break will
   *                                               have to occur in the block
   *           method_call                      -- Function Initialize and Controls Loop
   * 'block' := method_call                     -- Loop Block: Execute Single Method
   *            sequence                        -- Loop Block: Execute a Sequence
   * [OPTIONAL] 'on-success' := sequence_entry  -- Entry to Execute on Success
   *                                               (Loop Exited Without Errors)
   * [OPTIONAL] 'on-error'   := sequence_entry  -- Entry to Execute on Error
   *                                               (Does not call error on parent
   *                                               sequence, unless the sequence entry does)
   */
  var control = entry["loop"];
  if (_.isBoolean(control)) {
    control === true ? true : null;
  } else {
    control = _cleanupMethodDefinition(control);
  }

  if (control !== null) {
    var block = entry.hasOwnProperty("block") ? entry.block : null;
    if (!_isSequence(block)) {
      block = _cleanupMethodDefinition(control);
    }

    if (block) {
      // Cleanup 'on-success'
      var onSuccess = entry.hasOwnProperty("on-success") ?
                      _cleanupEntry(entry["on-success"]) : null;

      // Cleanup 'on-error'
      var onError = entry.hasOwnProperty("on-error") ? entry["on-error"] : null;
      if (!_.isBoolean(onError)) {
        onError = onError !== null ? _cleanupEntry(onError) : null;
      }

      return {
        "label": entry.label,
        "loop": control,
        "block": block,
        "on-success": onSuccess,
        "on-error": onError
      };
    }
  }

  return null;
}

function _cleanupObjectEntry(entry) {
  // Do we have a 'GOTO' Entry?
  if (entry.hasOwnProperty("goto")) { // YES: Clean it up
    return _cleanupGoToEntry(entry);
  }

  if (entry.hasOwnProperty("error")) { // YES: Clean it up
    return _cleanupErrorEntry(entry);
  }

  // Does the entry have a label?
  if (entry.hasOwnProperty("label")) { // YES: Clean it up
    entry.label = _cleanupLabel(entry.label);
  } else {
    entry.label = null;
  }

  // Is it an IF/THEN/ELSE Clause?
  if (entry.hasOwnProperty("if")) { // YES: Clean it up
    return _cleanupIfEntry(entry);
  }

  // Is it a LOOP Clause?
  if (entry.hasOwnProperty("loop")) { // YES: Clean it up
    return _cleanupLoopEntry(entry);
  }

  // Default Must be a Method Definition
  return _cleanupMethodDefinition(entry);
}

function _cleanupEntry(entry) {
  if (!_isSequence(entry)) {
    return _.isFunction(entry) ? _cleanupMethodDefinition(entry) : _cleanupObjectEntry(entry);
  }

  return entry;
}

function Sequence(parent) {
  // Reference to Parent Sequence
  this.__parent = parent;

  // Control Flags
  this.__breakOnErrors = true;

  // Errors List
  this.__errors = null;

  // Sequence Context
  this.__context = null;

  // Success / Error Handlers
  this.__onSuccess = null;
  this.__onError = null;

  // Process Control
  this.__finished = false;
  this.__current = 0;
  this.__calls = [];
  this.__stack = [];
  this.__labels = {};

  // Loop Control
  this.__loopErrors = null;
  this.__loopBlock = null;
  this.__loopRun = false;
  this.__loopExitEntry = false;
}

/**
 *
 * @param {type} parent
 * @returns {nm$_sequence.Sequence}
 */
Sequence.getInstance = function(parent) {
  return new Sequence(_isSequence(parent) ? parent : null);
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
  var newEntry = _cleanupEntry(entry);
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
  return this.__errors !== null;
};

Sequence.prototype.getErrors = function() {
  return this.__errors !== null ? this.__errors : [];
};

Sequence.prototype.errors = function(errors) {
  if (!this.isRootSequence()) {
    // Peek Stack
    var top = this.__stack.length ? this.__stack[this.__stack.length - 1] : null;

    // Is the Top of the Stack a 'loop' entry?
    if ((top !== null) && top.hasOwnProperty("loop")) { // YES
      // Errors must have been called from either Loop Check Function or Block Check Method
      this.__loopErrors = _appendToArray(this.__loopErrors, errors);
      return this.break();
    }
  }

  this.__errors = _appendToArray(this.__errors, errors);
  return this.__breakOnErrors ? this.break() : this.next();
};

Sequence.prototype.end = function() {
  this.__finished = true;

  // Is this a Child Sequence?
  if (!this.isRootSequence()) { // YES: Call the Parent Context's 'end'
    if (this.__errors !== null) { // Transfer Errors to Parent
      this.__parent._error(this.__errors);
    }
    return this._parentEnd();
  }

  // Did the run generate errors?
  if (this.__errors !== null) { // YES: Call Error Handler (if it exists)
    // Call the Error Handler for the Sequence
    return this.__onError !== null ?
           _wrappedCall(this.__context, this.__onError, this.__errors) : false;
  } else { // NO: Call the Success Handler for the Sequence (if it exists)
    return this.__onSuccess !== null ?
           _wrappedCall(this.__context, this.__onSuccess) : false;
  }
};

Sequence.prototype._parentEnd = function() {
  // Reset Context to Point to Correct Sequence
  this.__context.sequence(this.__parent);
  return this.__parent.end();
};

Sequence.prototype.goto = function(label) {
  // Is this sequence finished?
  if (this.finished) { // YES: Ignore Call
    throw "SEQUENCE: Called goto() after sequence completed.";
  }

  // Is Possible Valid Label?
  label = _nullOnEmpty(label);
  if (_.isNil(label)) { // NO
    throw "Missing or Invalid Goto Label";
  }

  // All Labels are Lower Case
  label = label.toLowerCase();

  // Do we want to exit, this and any parent sequences,
  switch (label) {
    case "continue": // We want to RESTART Loop
      return this.continue();
    case "break": // We want to END Current Sequence
      return this.break();
    case "end": // We want to END Everything
      return this.end();
    default: // Default Handling
      // Does the Label Exist?
      if (!this.__labels.hasOwnProperty(label)) { // NO
        throw "Missing Goto Label [" + label + "]";
      }

      this.__current = this.__labels[label];
  }
  return this.next();
};

Sequence.prototype.continue = function() {
  // Pop element Off Stack
  var top = this.__stack.pop();

  // Was a 'loop' at the top of stack?
  if (top.hasOwnProperty("loop")) { // YES
    // Are we Dealing with a Call from Within Loop Exit Entry?
    if (this.__loopExitEntry) { // YES
      return this._parentNext();
    }

    // Put the Loop back on the Stack
    this.__stack.push(top);

    // Did the 'continue' come from inside loop block?
    if (!_.isNil(this.__loopBlock)) { // YES: Re-run the Loop
      // Is the Loop Block just a Simple Method Call?
      if (!_isMethodCall(this.__loopBlock)) { // NO: it's a Sequence
        this.__loopErrors = _appendToArray(this.__loopErrors, this.__loopBlock.getErrors());
      }

      return this.__executeCheck(top);
    }

    return this.__executeBlock(top["block"]);
  }

  // Was an 'if' at the top of stack?
  if (top.hasOwnProperty("if")) { // YES
    // Does the 'if' have an 'then' clause?
    if (!_.isNil(top["then"])) { // YES: Treat a CONTINUE as if was a call to 'true'
      return this.__processEntry(top["then"]);
    }
  }

  return this.next();
};

Sequence.prototype._parentContinue = function() {
  // Reset Context to Point to Correct Sequence
  this.__context.sequence(this.__parent);
  return this.__parent.continue();
};

Sequence.prototype.break = function() {
  // Pop element Off Stack
  var top = this.__stack.pop();

  // Where we in the Middle of an 'if' or 'loop'?
  if (_.isNil(top)) { // NO: Just pass it up
    // Is this the 'root' sequence?
    if (this.isRootSequence()) { // YES: Then just end it
      return this.end();
    }

    // Did the Sequence Finish Normally? YES: Continue Parent, NO: Break Parent
    return this.finished ? this._parentContinue() : this._parentBreak();
  }

  // Was a 'loop' at the top of stack?
  if (top.hasOwnProperty("loop")) { // YES
    return this.__handleLoopBreak(top);
  }

  // Was an 'if' at the top of stack?
  if (top.hasOwnProperty("if")) { // YES
    // Does the 'if' have an 'else' clause?
    if (!_.isNil(top["else"])) { // YES: Treat a BREAK as if was a call to 'false'
      return this.__processEntry(top["else"]);
    }
  }

  return this.next();
};

Sequence.prototype._parentBreak = function() {
  // Reset Context to Point to Correct Sequence
  this.__context.sequence(this.__parent);
  return this.__parent.break();
};

Sequence.prototype.__handleLoopBreak = function(loop) {
  // Are we Dealing with a Call from Within Loop Exit Entry?
  if (this.__loopExitEntry) { // YES
    return this.__parent.break();
  }

  // Did the 'break' occur in the Check Function?
  if (_.isNil(this.__loopBlock)) { // YES
    // Has the Loop Block been Executed (at least once)?
    if (this.__loopRun) { // YES: We have to do Loop Exit Processing
      return this.__exitLoop(loop);
    } else {
      return this.__loopErrors === null ?
              this._parentNext() :
              this._parentErrors(this.__loopErrors);
    }
  } else { // NO: It occurred in the Block : We have to do Loop Exit Processing
    return this.__exitLoop(loop);
  }
};

Sequence.prototype.__exitLoop = function(loop) {
  if (this.__loopErrors === null) {
    if (loop.hasOwnProperty("on-success")) {
      this.__stack.push(loop);
      this.__loopExitEntry = true;
      return this._processEntry(loop["on-success"]);
    }
    return this._parentErrors(this.__loopErrors);
  } else {
    if (loop.hasOwnProperty("on-error")) {
      this.__stack.push(loop);
      this.__loopExitEntry = true;
      return this._processEntry(loop["on-error"]);
    }

    return this._parentErrors(this.__loopErrors);
  }
};

Sequence.prototype.next = function() {
  // Is this sequence finished?
  if (this.finished) { // YES: Ignore Call
    throw "SEQUENCE: Called next() after sequence completed.";
  }

  if (this.__current < this.__calls.length) {
    return this.__processEntry(this.__calls[this.__current++]);
  } else if (this.__current === this.__calls.length) {
    return this.break();
  }
};

Sequence.prototype._parentNext = function() {
  // Reset Context to Point to Correct Sequence
  this.__context.sequence(this.__parent);
  return this.__parent.next();
};

Sequence.prototype._parentErrors = function(errors) {
  // Reset Context to Point to Correct Sequence
  this.__context.sequence(this.__parent);
  return this.__parent.errors(errors);
};

Sequence.prototype.true = function() {
  return this.continue();
};

Sequence.prototype.false = function() {
  return this.break();
};

Sequence.prototype.__processEntry = function(entry) {
  // Is the Entry a Sequence?
  if (entry instanceof Sequence) { // YES: Run it
    entry.setParent(this);
    return entry.start(this.__context);
  }

  // Is the Entry a Error Statement?
  if (entry.hasOwnProperty("error")) { // YES
    var error = entry.error;

    // Should we call a Method?
    if (_isMethodCall(error)) { // YES
      /* Treat Method Call as async (i.e. the method will have to call
       * .next()/.continue()/.error() as it sees fit
       */
      return _callMethod(this.__context, error);
    } else { // NO: Just Pass the String to the Errors Handler
      return this.errors(error);
    }
  }

  // Is the Entry a Goto Statement?
  if (entry.hasOwnProperty("goto")) { // YES
    var label = entry.goto;
    return this.goto(_isMethodCall(label) ? _callMethod(this.__context, label) : label);
  }

  // Is the Entry an If Statement?
  if (entry.hasOwnProperty("if")) { // YES
    return this.__processIF(entry);
  }

  // Is the Entry a Loop Statement?
  if (entry.hasOwnProperty("loop")) { // YES
    return this.__processLOOP(entry);
  }

  // Is a Method Call?
  if (_isMethodCall(entry)) {
    return _callMethod(this.__context, entry);
  }

  // Invalid Method Entry
  console.log(entry);
  throw "Invalid Sequence Entry";
};

Sequence.prototype.__processIF = function(entry) {
  this.__stack.push(entry);
  return _callMethod(this.__context, entry["if"]);
};

Sequence.prototype.__processLOOP = function(entry) {
  this.__stack.push(entry);
  this.__loopErrors = [];
  this.__loopRun = false;
  this.__loopExitEntry = false;
  return this.__executeCheck(entry);
};

Sequence.prototype.__executeCheck = function(entry) {
  var check = entry["loop"];
  this.__loopBlock = null;
  return _.isBoolean(check) ?
         this.__executeBlock(entry["block"]) : _callMethod(this.__context, check);
};

Sequence.prototype.__executeBlock = function(block) {
  this.__loopBlock = block;
  this.__loopRun = true;
  return this.__processEntry(block);
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
        return this.__sequence.errors(err);
      },
      end: function() {
        return this.__sequence.end();
      },
      goto: function(label) {
        return this.__sequence.goto(label);
      },
      next: function() {
        return this.__sequence.next();
      },
      break: function() { // Stop the Loop
        return this.__sequence.break();
      },
      continue: function() { // Continue the Loop
        return this.__sequence.continue();
      },
      "true": function() { // Continue the Loop
        return this.__sequence.true();
      },
      "false": function() { // Continue the Loop
        return this.__sequence.false();
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
    // Initialize Sequence
    this.__finished = false;
    this.__current = 0;
    this.__stack = [];
    this.__context = context;

    // Start the Sequence
    this.next();
  } catch (e) {
    this.__errors = _appendToArray(this.__errors, e);
    this.end();
  }

  return this;
};

// Export Constructor
module.exports = Sequence;
