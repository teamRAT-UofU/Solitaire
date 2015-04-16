//solitaireModel.js

(function(window) {

	var SUITS = ["hearts", "diamonds", "clubs", "spades"];
	//enums
	var SUIT_COLOR = { hearts : { color : "red" },
				  diamonds : { color : "red"},
				  clubs : { color : "black" },
				  spades : { color : "black" }
	};

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
			var newPile = new SolitairePile(pile.pileType);
			for(var j = 0; j < pile.count; j++)
			{
				newPile.putCard(deck[deckIndex++]);
			}
			this.piles[pile.id] = newPile;
		}

		if(deckIndex < deck.length)
		{
			console.log("RuleDef warning: some cards undealt.");
		}
	};

	SolitaireModel.prototype._makeDeck = function(deckType)
	{
		var deck = [];
		if(deckType === "standard-deck")
		{
			for(var suitIndex = 0; suitIndex < SUITS.length; suitIndex++)
			{
				var suit = SUITS[suitIndex];
				for(var rank = 0; rank < 13; rank++)
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
		return this._evaluateRule(grabRules, { grabTarget : card });
	};

	SolitaireModel.prototype.canDropCard = function(card, pile, pos)
	{
		var dropRules = this.game.rules.pileTypes[card.pile.pileType].drop;
		var dropTarget = pile.peekCard(pos);
		return this._evaluateRule(dropRules, { held : card, pile : pile, dropTarget : dropTarget });
	};

	//recursively evaluate a "rule" entry
	//context: object that stores reference to model objects that will be needed in the rule parsing
	//		e.g. - a "grab" rule must provide a 'target', "drop" must provide 'held', 'target', and 'pile'
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
		var rhs = null;
		if(target2 === null)
			rhs = condition.value;
		else
			this._getAttributeValue(condition.attribute, target2);

		var objectComparison = false;
		//transform the value of rhs based on parameters
		if(condition.value === 'alt')
		{
			objectComparison = true;
			if(target2 === null && typeof condition.target === 'undefined')
				return true;
			if(condition.attribute !== 'color')
				throw new Error("RuleDefinition: condition value " + condition.value + 
					" not allowed on attribute  " + condition.attribute);

			if(rhs === 'red')
				rhs = 'black';
			else if(rhs === 'black')
				rhs = 'red';
		}
		else if(condition.value === 'same')
		{
			objectComparison = true;
		}
		else if(condition.value.slice(0,1) === '+' || condition.value.slice(0,1) === '-')
		{
			objectComparison = true;
			var relativeValue = parseInt(condition.value);
			rhs += relativeValue;
		}

		//automatically succeed on object comparisons if either target is null
		if(objectComparison && (lhs === null || rhs === null))
			return true;

		if(condition.relation === '=')
		{
			return rhs === lhs;
		}
		else if(condition.relation === '!=')
		{
			return rhs !== lhs;
		}
		else if(condition.relation === '<')
		{
			return rhs < lhs;
		}
		else if(condition.relation === '>')
		{
			return rhs > lhs;
		}
		else
		{
			throw new Error("RuleDefinition: unknown relation " + condition.relation);
		}
	};

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
				return SUIT_COLOR[target.suit];
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
				if(currentPosition >= 0 && currentPosition < targetObj.pile.getCount())
				{
					selection.push(targetObj.pile.peekCard(currentPosition));
				}
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
		card.pile.removeCard(card);
		//run grab triggers

		pile.putCard(card, pos);
		//run drop from triggers
		//run drop to triggers		
	};

	window.SolitaireModel = SolitaireModel;

	var SolitairePile = function(pileType)
	{
		this.pileType = pileType;

		this.pile = [];
	};

	SolitairePile.prototype.putCard = function(card, pos) {	
		this.pile.splice(this._indexFromPosition(pos), 0, card);

		card.pile = this;
	};

	SolitairePile.prototype.peekCard = function(pos) {
		
		return this.pile[this._indexFromPosition(pos)];
	};

	SolitairePile.prototype.removeCard = function(pos) {
		var card = this.pile.splice(this._indexFromPosition(pos), 1)[0];
		card.pile = null;
		return card;
	};

	SolitairePile.prototype.getCount = function() {
		return this.pile.length;
	};

	SolitairePile.prototype.getCardPosition = function(card) {
		return this.pile.indexOf(card);
	};

	SolitairePile.prototype._indexFromPosition = function(pos) {
		if(typeof pos === 'undefined')
		{
			return this.pile.length - 1;
		}
		else if(typeof pos === 'string')
		{
			if(pos.slice(0,3) === 'top')
			{
				var position = this.pile.length - 1;
				if(pos.length > 3)
					position -= parseInt(pos.slice(3));
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

	var SolitaireCard = function(suit, rank, facingUp) {
		this.pile = null;
		this.suit = suit;
		this.rank = rank;
		this.facingUp = facingUp;
	};

})(window);