//solitaireModel.js

(function(window) {

	//fisher-yates shuffle, implementation from http://stackoverflow.com/a/2450976
	var shuffle = function(array) {
		var currentIndex = array.length, temporaryValue, randomIndex ;

		// While there remain elements to shuffle...
		while (0 !== currentIndex) {

		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
  }

  return array;
}

	//classes
	var SolitaireModel = function()
	{
		//events
		this.onNewGameReady = null;
		this.onCardMoved = null;
		this.onCardUpdated = null;
		this.onGameWon = null;
	};

	//enums
	SolitaireModel.prototype.SUITS = ["hearts", "diamonds", "clubs", "spades"];
	SolitaireModel.prototype.SUIT_COLOR = { hearts : "red",
				  diamonds : "red",
				  clubs : "black",
				  spades : "black"
	};

	SolitaireModel.prototype.newGame = function(gameRules)
	{
		this.game = gameRules.rules;
		this.piles = {}; //dictionary of piles by id

		//setup layout
		//get cards that the game will use
		var deck = [];

		var cards =  this.game.layout.cards;
		if(!Array.isArray(cards))
			cards = [cards];
		for(var i = 0; i < cards.length; i++)
		{
			var deckObj = cards[i];
			var singleDeck = this._makeDeck(deckObj.cardType);
			for(var j = 0; j < deckObj.count; j++)
			{
				deck = deck.concat(singleDeck);
			}
		}

		shuffle(deck);

		var deckIndex = 0;

		//create piles and deal cards
		for(var i = 0; i < this.game.layout.piles.length; i++)
		{
			var pile = this.game.layout.piles[i];
			var fanCount = this.game.rules.pileTypes[pile.pileType].fanCount;
			if(typeof fanCount === 'undefined')
				fanCount = Number.POSITIVE_INFINITY;
			var fanDirection = this.game.rules.pileTypes[pile.pileType].fanDirection;
			if(typeof fanDirection === 'undefined')
				fanDirection = 'down';
			var newPile = new SolitairePile(pile.id, pile.pileType, pile.position, fanCount, fanDirection);
			var facingUp = true;
			var setupRules = this.game.rules.pileTypes[pile.pileType].setup;
			for(var j = 0; j < pile.count; j++)
			{
				var card = deck[deckIndex++];

				if(setupRules.facing === 'up')
					card.facingUp = true;
				else if(setupRules.facing === 'down')
					card.facingUp = false;
				else if(setupRules.facing === 'only-top-up')
				{
					if(j == pile.count - 1)
						card.facingUp = true;
					else
						card.facingUp = false;
				}
				else if(setupRules.facing === 'only-top-down')
				{
					if(j == pile.count - 1)
						card.facingUp = false;
					else
						card.facingUp = true;
				}
				newPile.putCard(card);
			}
			this.piles[pile.id] = newPile;
		}

		if(deckIndex < deck.length)
		{
			console.log("RuleDef warning: some cards undealt.");
		}

		this.onNewGameReady(this.piles, this.game.layout.tableGrid);

	};

	SolitaireModel.prototype._makeDeck = function(deckType)
	{
		var deck = [];
		if(deckType === "standard-deck")
		{
			for(var suitIndex = 0; suitIndex < this.SUITS.length; suitIndex++)
			{
				var suit = this.SUITS[suitIndex];
				for(var rank = 1; rank <= 13; rank++)
				{
					deck.push(new SolitaireCard(suit, rank, false));
				}
			}
		}
		return deck;
	};

	SolitaireModel.prototype._getPilesByType = function(pileType)
	{
		var piles = [];
		for (var pileId in this.piles) 
		{
		    if (this.piles.hasOwnProperty(pileId)) 
		    {
		    	var pile = this.piles[pileId];
		        if(pile.pileType === pileType)
		        	piles.push(pile);
		    }
		}

		return piles;
	};

	SolitaireModel.prototype.canGrabCard = function(card)
	{
		var grabRules = this.game.rules.pileTypes[card.pile.pileType].grab;
		if(typeof grabRules === 'undefined')
			return true;
		return this._evaluateRule(grabRules, { grabTarget : card });
	};

	SolitaireModel.prototype.canDropCard = function(card, pile, pos)
	{
		var dropRules = this.game.rules.pileTypes[pile.pileType].drop;
		if(typeof dropRules === 'undefined')
			return true;
		var dropTarget = pile.peekCard(pos);
		return this._evaluateRule(dropRules, { held : card, pile : pile, dropTarget : dropTarget });
	};

	//For each rule-action pair, if the rule evaluates to true, then execute the action 
	SolitaireModel.prototype._evaluateRuleActionPairs = function(ruleActionPairs, context)
	{
		if(typeof ruleActionPairs === 'undefined')
			return;

		if(typeof ruleActionPairs === 'string')
			ruleActionPairs = [ruleActionPairs];
		for(var i = 0; i < ruleActionPairs.length; i++)
		{
			var rule = ruleActionPairs[i].rule;
			var action = ruleActionPairs[i].action;
			if(typeof rule === 'undefined' || this._evaluateRule(rule, context))
			{
				this._evaluateAction(action, context);
			}
		}
	}

	//execute an action, such as flipping card facing and moving cards
	SolitaireModel.prototype._evaluateAction = function(action, context)
	{
		var target = this._findTarget(action.target, context);
		var args = action.arguments;
		if(typeof args === 'string')
			args = [args];
		if(action.command === 'face')
		{
			if(args[0] === 'up')
				target.facingUp = true;
			else if(args[0] === 'down')
				target.facingUp = false;
			else
				throw new Error("RuleDefinition: invalid argument " + args[0] + " on command " + action.command);

			this.onCardUpdated(target);
		}
		else if(action.command === 'move')
		{
			var target2 = this._findTarget(args[0], context);
			if(!Array.isArray(target))
				target = [target];
			for(var i = 0; i < target.length; i++)
			{
				this.moveCard(target[i], target2, args[1]);
			}
			if(args[2] === 'up')
				target.facingUp = true;
			else if(args[2] === 'down')
				target.facingUp = false;
			else
				throw new Error("RuleDefinition: invalid argument " + args[1] + " on command " + action.command);

			this.onCardUpdated(target);
		}
		else if(action.command === 'win')
		{
			this.onGameWon();
		}
		else
		{
			throw new Error("RuleDefinition: unknown command " + action.command);
		}
	}

	//recursively evaluate a "rule" entry
	//context: object that stores reference to model objects that will be needed in the rule parsing
	//		e.g. - a "grab" rule must provide a 'grabTarget', "drop" must provide 'held', 'dropTarget', and 'pile'
	//returns true/false
	SolitaireModel.prototype._evaluateRule = function(rule, context)
	{
		//check if it is a boolean expression. if it is, recursively evaluate rules in the expression
		if(rule.hasOwnProperty('AND'))
		{
			for(var i = 0; i < rule.AND.length; i++)
			{
				//evaluate, short circuit
				if(this._evaluateRule(rule.AND[i], context) === false)
					return false;
			}
			return true;
		}

		else if(rule.hasOwnProperty('OR'))
		{
			for(var i = 0; i < rule.OR.length; i++)
			{
				//evaluate, short circuit
				if(this._evaluateRule(rule.OR[i], context) === true)
					return true;
			}
			return false;
		}
		else
		{
			//base case, assume this is a rule
			var targetObj = this._findTarget(rule.target, context);
			var targetObj2 = null;
			if(rule.condition.hasOwnProperty('target'))
				targetObj2 = this._findTarget(rule.condition.target, context);

			return this._evaluateCondition(rule.condition, targetObj, targetObj2);
		}
	};

	SolitaireModel.prototype._evaluateCondition = function(condition, target, target2)
	{
		var lhs = this._getAttributeValue(condition.attribute, target);
		var allRhs = [];
		if(target2 === null)
		{
			//if condition.value is an object comparison but target2 is null, we don't need to compare
			if(condition.value === 'alt' || condition.value === 'same' || condition.value.slice(0,3) === 'run' || condition.value.slice(0,1) === '+' || condition.value.slice(0,1) === '-')
				return true;

			//otherwise, value is an absolute value
			allRhs.push(condition.value);
		}
		else
		{
			//convert target2 to rhs values
			if(!Array.isArray(target2))
				target2 = [target2];
			for(var i = 0; i < target2.length; i++)
			{
				allRhs.push(this._getAttributeValue(condition.attribute, target2[i]));
			}
		}

		for(var i = 0; i < allRhs.length; i++)
		{
			var rhs = allRhs[i];
			var objectComparison = false;
			//transform the value of rhs and lhs based on parameters
			if(condition.value === 'alt')
			{
				objectComparison = true;
				if(target2 === null && typeof condition.target === 'undefined')
					continue;
				if(condition.attribute !== 'color')
					throw new Error("RuleDefinition: condition value " + condition.value + 
						" not allowed on attribute  " + condition.attribute);

				//set lhs to the last value
				if(i > 0)
					lhs = allRhs[i - 1];

				//alternate rhs color
				if(rhs === 'red')
					rhs = 'black';
				else if(rhs === 'black')
					rhs = 'red';
			}
			else if(condition.value === 'same')
			{
				objectComparison = true;
			}
			//note: on relatives we SUBTRACT the value instead of multiply, because we are "fixing" the RHS value to make it equal, less then, etc
			else if(condition.value.slice(0,3) === 'run')
			{
				objectComparison = true;
				var relativeValue = parseInt(condition.value.slice(3));
				rhs -= relativeValue * (i + 1);

			}
			else if(condition.value.slice(0,1) === '+' || condition.value.slice(0,1) === '-')
			{
				objectComparison = true;
				var relativeValue = parseInt(condition.value);
				rhs -= relativeValue;
			}

			//automatically succeed on object comparisons if either target is null
			if(objectComparison && (lhs === null || rhs === null))
				continue;

			//if lhs is number and rhs is not a number, parse rhs as an integer
			if(typeof lhs === 'number' && typeof rhs !== 'number')
				rhs = parseInt(rhs);

			if(!this._evaluateComparision(lhs, rhs, condition.relation))
				return false;
		}
		return true;
	};

	SolitaireModel.prototype._evaluateComparision = function(lhs, rhs, relation)
	{
		if(relation === '=')
		{
			return lhs === rhs;
		}
		else if(relation === '!=')
		{
			return lhs !== rhs;
		}
		else if(relation === '<')
		{
			return lhs < rhs;
		}
		else if(relation === '>')
		{
			return lhs > rhs;
		}
		else if(relation === '<=')
		{
			return lhs <= rhs;
		}
		else if(relation === '>=')
		{
			return lhs >= rhs;
		}
		else
		{
			throw new Error("RuleDefinition: unknown relation " + condition.relation);
		}
	};

	//returns the value of an attribute, given the name of the attribute as a string, usually provided by a rule 'condition'
	SolitaireModel.prototype._getAttributeValue = function(attribute, target)
	{
		switch(attribute)
		{
			//pile attributes
			case 'count':
				return target.getCount();
			//card attributes
			case 'suit':
				return target.suit;
			case 'color':
				return this.SUIT_COLOR[target.suit];
			case 'rank':
				return target.rank;
			case 'facing':
				if(target.facingUp)
					return 'up';
				else
					return 'down';
			case 'position':
				return target.pile.getCardPosition(target);
			default:
				throw new Error("RuleDefinition: unknown attribute " + attribute);
				break;
		}
	};


	//returns the Model object referred to by the target string in the given context
	//returns null if the target has the #pos selector and it went out of bounds
	//throws on errors
	SolitaireModel.prototype._findTarget = function(target, context)
	{

		var targetId = null;
		var targetIdType = 'id';
		var targetSelector = { id: 'this', count: 1};
		if(typeof target === 'string')
		{
			targetId = target;
		}
		else
		{
			if(target.hasOwnProperty('id'))
			{
				targetId = target.id;
			}
			else
			{
				throw new Error("RuleDefinition: target id required on target " + target);
			}
			if(target.hasOwnProperty('idType'))
			{
				targetIdType = target.idType;
			}
			if(target.hasOwnProperty('selector'))
			{
				targetSelector = target.selector;
				if(typeof targetSelector === 'string')
				{
					targetSelector = { id: targetSelector, count: 1};
				}
				if(typeof targetSelector.count === 'string')
				{
					if(targetSelector.count === 'all')
						targetSelector.count = Number.POSITIVE_INFINITY;
					else
						throw new Error("RuleDefinition: unknown count " + targetSelector.count + " on target " + targetId);

				}
			}
		}
		
		var targetObj = null;
		if(targetIdType === 'pileType')
		{
			//find all piles of type
			targetObj = this._getPilesByType(targetId);

		}
		else if(targetIdType === 'id')
		{
			//first check the context for any keyword ids
			if(context.hasOwnProperty(targetId))
			{
				targetObj = context[targetId];
			}
			//not found in context, try finding a pile with the id
			else if(this.piles.hasOwnProperty(targetId))
			{
				targetObj = this.piles[targetId];
			}
			else
			{
				//invalid id
				throw new Error("RuleDefinition: target id " + targetId + " not found on target " + targetId);
			}
		}
		else
		{
			//invalid idType
			throw new Error("RuleDefinition: unknown target idType " + targetIdType + " on target " + targetId);
		}

		//use selector to refine selection
		if(targetSelector.id.slice(0,3) === 'top' || targetSelector.id.slice(0,3) === 'bot')
		{
			if(!(targetObj instanceof SolitairePile))
				throw new Error("RuleDefinition: selector " + targetSelector + "not allowed on target " + targetId +
									" of type " + typeof targetObj);
			
			var startIndex = 0;
			if(targetSelector.id.length > 3)
				startIndex = parseInt(pos.slice(3));
			var selection = [];
			for(var i  = 0; i < targetSelector.count; i++)
			{
				selection.push(targetObj.peekCard(targetSelector.id + (startIndex + i)));
			}
			targetObj = selection;
			
		}
		else if(targetSelector.id.slice(0,3) === 'pos')
		{
			if(!(targetObj instanceof SolitaireCard))
				throw new Error("RuleDefinition: selector " + targetSelector.id + " not allowed on target " + targetId +
									" of type " + targetObj.contructor);
			
			var sign = targetSelector.id.slice(3,4);
			var targetPosition = 0;
			if(sign === '+' || sign === '-')
			{
				//relative
				var relativeIndex = parseInt(targetSelector.id.slice(3));
				targetPosition = targetObj.pile.getCardPosition(targetObj) + relativeIndex;
			}
			else
			{
				//absolute
				targetPosition = parseInt(targetSelector.slice(3));
			}

			var selection = [];

			for(var i = 0; i < targetSelector.count; i++)
			{
				var currentPosition = targetPosition + i;
				if(currentPosition < 0 || currentPosition >= targetObj.pile.getCount())
					break;

				selection.push(targetObj.pile.peekCard(currentPosition));

			}
			targetObj = selection;
		}
		else if(targetSelector.id === 'above')
		{
			if(!(targetObj instanceof SolitaireCard))
				throw new Error("RuleDefinition: selector " + targetSelector.id + " not allowed on target " + targetId +
									" of type " + targetObj.contructor);
			var targetPosition = targetObj.pile.getCardPosition(targetObj) + 1;
			var selection = [];
			for(var i = 0; i < targetSelector.count; i++)
			{
				var currentPosition = targetPosition + i;
				if(currentPosition < 0 || currentPosition >= targetObj.pile.getCount())
					break;

				selection.push(targetObj.pile.peekCard(currentPosition));

			}
			targetObj = selection;
		}
		else if(targetSelector.id === 'below')
		{
			if(!(targetObj instanceof SolitaireCard))
				throw new Error("RuleDefinition: selector " + targetSelector.id + " not allowed on target " + targetId +
									" of type " + targetObj.contructor);
			var targetPosition = targetObj.pile.getCardPosition(targetObj) - 1;
			var selection = [];
			for(var i = 0; i < targetSelector.count; i++)
			{
				var currentPosition = targetPosition + i;
				if(currentPosition < 0 || currentPosition >= targetObj.pile.getCount())
					break;

				selection.push(targetObj.pile.peekCard(currentPosition));

			}
			targetObj = selection;
		}
		else if(targetSelector.id === 'this')
		{
			//do nothing (targetObj = targetObj)
		}
		else
		{
			throw new Error("RuleDefiniton: unknown selector " + targetSelector.id + " on target " + targetId);
		}

		if(targetObj.length === 0)
			targetObj = null;
		else if(targetObj.length === 1)
			targetObj = targetObj[0];

		return targetObj;
	};

	SolitaireModel.prototype.moveCard = function(card, pile, pos)
	{
		var triggers = this.game.rules.pileTypes[card.pile.pileType].triggers;
		var dropTarget = pile.peekCard(pos);

		card.pile.removeCard(card.pile.getCardPosition(card));
		if(typeof triggers !== 'undefined')
		{
			//run grab triggers
			this._evaluateRuleActionPairs(triggers.onGrab, { grabTarget : card, pile : card.pile });
		}

		pile.putCard(card, pos);
		if(typeof triggers !== 'undefined')
		{
			//run drop from triggers
			this._evaluateRuleActionPairs(triggers.onDropFrom, { dropTarget : dropTarget, held : card, pile : card.pile});
			//run drop to triggers		
			this._evaluateRuleActionPairs(triggers.onDropOnto, { dropTarget : dropTarget, held : card, pile : pile });
		}

		this.onCardMoved(card);
	};

	SolitaireModel.prototype.activatePile = function(pile, card)
	{
		var activateRule = this.game.rules.pileTypes[pile.pileType].activate;
		this._evaluateRuleActionPairs(activateRule, { pile: pile, activateTarget : card});
	};

	window.SolitaireModel = SolitaireModel;

	//class representing a single pile on the table
	//all pile modifiers (putCard, peekCard, removeCard) take a 'pos' parameter
	//if pos is undefined, selects the top card
	//if pos is a string, valid selectors are: 'top', 'bot'
	//if pos is a number, selects via index, where 0 is the bottom and length-1 is the top
	//note that insertion places the card at the index, moving all cards above that index
	//this means that putCard('top') inserts at the index pile.length, but peekCard('top') selects the card at pile.length-1
	var SolitairePile = function(pileId, pileType, position, fanCount, fanDirection)
	{
		this.pileId = pileId;
		this.pileType = pileType;
		this.position = position;
		this.fanCount = fanCount;
		this.fanDirection = fanDirection;

		this.pile = [];
	};

	SolitairePile.prototype.putCard = function(card, pos) {	
		this.pile.splice(this._indexFromPosition(pos, true), 0, card);

		card.pile = this;
	};

	SolitairePile.prototype.peekCard = function(pos) {
		
		return this.pile[this._indexFromPosition(pos, false)];
	};

	SolitairePile.prototype.removeCard = function(pos) {
		var card = this.pile.splice(this._indexFromPosition(pos, false), 1)[0];
		card.pile = null;
		return card;
	};

	SolitairePile.prototype.getCount = function() {
		return this.pile.length;
	};

	SolitairePile.prototype.getCardPosition = function(card) {
		return this.pile.indexOf(card);
	};

	SolitairePile.prototype._indexFromPosition = function(pos, insert) {
		if(typeof pos === 'undefined')
		{
			if(insert)
				return this.pile.length;
			else
				return this.pile.length - 1;
		}
		else if(typeof pos === 'string')
		{
			if(pos.slice(0,3) === 'top')
			{
				var position = this.pile.length - 1;
				if(pos.length > 3)
					position -= parseInt(pos.slice(3));

				if(insert)
					position += 1;
				return position;
			}
			else if(pos.slice(0,3) === 'bot')
			{
				var position = 0;
				if(pos.length > 3)
					position += parseInt(pos.slice(3));
				return position;
			}
		}
		else
			return pos;
	};

	//represents a single card in the solitaire game
	//all cards belong to a pile, this.pile is only null while actively moving a card in the moveCard function
	var SolitaireCard = function(suit, rank, facingUp) {
		this.pile = null;
		this.suit = suit;
		this.rank = rank;
		this.facingUp = facingUp;
	};

	window.SolitaireCard = SolitaireCard;

})(window);