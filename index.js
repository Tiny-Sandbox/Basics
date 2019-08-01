const chroma = require("chroma-js");

function lighten(hex) {
	return chroma(hex).brighten().hex();
}

function tint(hex, hex2, percent = 0.25) {
	return chroma.mix(chroma(hex), chroma(hex2), percent);
}

function randItem(array) {
	return array[Math.floor(Math.random() * array.length)];
}

const performance = require("performance-now");

class Space {
	constructor(x = 0, y = 0) {
		this.position = {
			x: x,
			y: y,
		};

		this.color = "white";

		this.oldTile = null;
		this.occupying = null;
	}

	isPowered() {
		return false;
	}

	getRendering() {
		return {
			type: "color",
			color: this.color,
		};
	}

	getPreviewRendering() {
		return this.getRendering();
	}

	changeTo(newSpace, arenaMap) {
		newSpace.position.x = this.position.x;
		newSpace.position.y = this.position.y;
		newSpace.oldTile = this;
		newSpace.occupying = this.constructor.name;
		arenaMap.map[this.position.y][this.position.x] = newSpace;
	}

	collides() {
		return false;
	}

	afterTurn() {
		return;
	}

	changeBack(arenaMap) {
		if (this.oldTile) {
			this.changeTo(this.oldTile, arenaMap);
			return true;
		} else {
			return false;
		}
	}

	toString() {
		return this.constructor.name;
	}
}

function neighborPowered(tile, arenaMap) {
	const neighbors = [];
	for (let loop = 0; loop < 4; loop++) {
		const neighborWeAreOn = arenaMap.neighbor(tile, loop);
		if (neighborWeAreOn) {
			neighbors.push(neighborWeAreOn);
		}
	}

	return neighbors.some(oneTile => {
		return oneTile.isPowered();
	});
}

class SpawnableSpace extends Space {
	constructor(restrictedTo, x, y) {
		super(x, y);
		this.restriction = restrictedTo ? restrictedTo : null;
	}

	toString() {
		return "Spawn space";
	}
}

class Wall extends Space {
	constructor(x, y) {
		super(x, y);
		this.color = "black";
	}

	collides() {
		return true;
	}
}

class Occupied extends Wall {
	constructor(player, x, y) {
		super(x, y);
		this.occupiedBy = player;
	}

	getRendering() {
		return {
			type: "color",
			color: this.occupiedBy.color,
		};
	}

	getPreviewRendering() {
		return {
			type: "color",
			color: "red",
		};
	}

	toString() {
		return `Player ${this.occupiedBy.id + 1}'s tile`;
	}
}

class ColoredWall extends Wall {
	constructor(color, x, y) {
		super(x, y);
		this.color = color;
	}
	changeColor(newColor) {
		this.color = newColor;
	}
	toString() {
		return `Wall colored ${this.color}`;
	}
}

class PowerSource extends Wall {
	constructor(x, y) {
		super(x, y);
	}

	getRendering() {
		return {
			type: "color",
			color: "red",
		};
	}

	isPowered() {
		return true;
	}
}

function indicatorRendering(expression) {
	return expression ? {
		type: "image",
		// Image: indOn,
	} : {
		type: "color",
		color: "#4b3621",
	};
}

class PowerIndicator extends Wall {
	constructor(x, y) {
		super(x, y);
	}

	getRendering() {
		return indicatorRendering(neighborPowered(this));
	}
}

class FlashingIndicator extends Wall {
	constructor(x, y, flashTiming = 1000) {
		super(x, y);
		this.flashTiming = flashTiming;
	}

	getRendering() {
		return indicatorRendering(Math.round(performance() / this.flashTiming) % 2);
	}
}

class PowerCarrier extends Space {}

class PowerCarrierWall extends Wall {}

class Teleporter extends Space {
	constructor(id, x, y) {
		super(x, y);

		this.id = id;
		this.color = "purple";
	}

	collides() {
		return false;
	}

	afterTurn(player, players, arenaMap) {
		const compatTeleports = arenaMap.getMatchingTiles(tile => {
			return tile.constructor.name === "Teleporter" && tile.id === this.id;
		});
		const exit = randItem(compatTeleports);

		const pos = player.position;
		const plTile = arenaMap.getTile(pos.x, pos.y);
		const exitTile = arenaMap.getTile(exit.position.x, exit.position.y);

		plTile.changeBack();
		exitTile.changeTo(plTile, arenaMap);

		players[player.id].position.x = exit.position.x;
		players[player.id].position.y = exit.position.y;
	}
}

class Turf extends Space {
	constructor(recaptures, x, y) {
		super(x, y);
		this.capturedBy = null;
		this.recaptures = recaptures;
		this.captureCount = 0;
	}
	getRendering() {
		return {
			type: "color",
			color: this.capturedBy ? lighten(this.capturedBy.color) : "#FFFFFF",
		};
	}
	collides(d, p) {
		if ((this.recaptures >= this.captureCount || !this.capturedBy)) {
			this.capturedBy = p;
			this.captureCount++;
		}

		return false;
	}

	toString() {
		if (this.capturedBy) {
			return `Player ${this.capturedBy.id + 1}'s turf`;
		} else {
			return this.constructor.name;
		}
	}
}

class PowerTurf extends Turf {
	constructor(recaptures, x, y) {
		super(recaptures, x, y);
	}

	isPowered() {
		return this.capturedBy && neighborPowered(this);
	}
	getRendering() {
		return {
			type: "color",
			color: tint(lighten(this.capturedBy ? this.capturedBy.color : "#FFFFFF"), "yellow"),
		};
	}
	toString() {
		if (this.capturedBy) {
			return `Player ${this.capturedBy.id + 1}'s power-connecting turf`;
		} else {
			return "Power-connecting turf";
		}
	}
}

class HomeSpace extends Wall {
	constructor(owner, x, y) {
		super(x, y);
		this.owner = owner;
	}

	collides(direction, player) {
		return player.id !== this.owner.id;
	}

	getRendering() {
		return {
			type: "color",
			color: this.owner.color,
		};
	}

	getPreviewRendering() {
		return {
			type: "color",
			color: "red",
		};
	}

	toString() {
		return `Player ${this.owner.id + 1}'s home tile`;
	}
}
class LockedWall extends Wall {
	constructor(x, y, keysNeeded = 1, takeAwayKeys = false) {
		super(x, y);
		this.color = "slategray";

		this.keysNeeded = keysNeeded;
		this.takeAwayKeys = takeAwayKeys;
	}

	collides(direction, player, players) {
		if (player.keys < this.keysNeeded) {
			return true;
		} else {
			if (this.takeAwayKeys) {
				players[player.id].keys -= this.keysNeeded;
			}
			return false;
		}
	}

	toString() {
		return `${this.takeAwayKeys ? "Unstable l" : "L"}ocked wall requiring ${this.keysNeeded} key${this.keysNeeded === 1 ? "" : "s"}`;
	}
}

const directions = [
	"north",
	"east",
	"south",
	"west",
];

class DirectionalWall extends Wall {
	// This type of wall only collides in one direction
	constructor(direction, x, y) {
		super(x, y);

		this.color = "#FFEE00";
		this.direction = direction > -1 && direction < 4 ? direction : 0;
	}

	collides(direction = 2) {
		return direction === this.direction;
	}

	toString() {
		return `One-way gate facing ${directions[this.direction]}`;
	}
}

class ToggleableWall extends Wall {
	// This type of wall can be toggled for collision, but starts out closed
	constructor(x, y) {
		super(x, y);

		this.color = "pink";
		this.closed = true;
	}

	collides() {
		return this.closed;
	}

	doFacingAction() {
		this.closed = !this.closed;
	}

	toString() {
		return `${this.closed ? "Closed t" : "T"}oggleable wall`;
	}
}

class ItemBox extends Space {
	constructor(x, y) {
		super(x, y);

		this.color = "#dd66ff";
		this.active = true;
	}

	collides(direction, player, players) {
		if (this.active) {
			players[player.id].keys += 1;
			this.active = false;
		}
		return false;
	}

	toString() {
		return this.active ? "Item box" : "Empty item box";
	}
}

module.exports = {
	tiles: {
		Space,
		SpawnableSpace,
		Wall,
		Occupied,
		ColoredWall,
		PowerSource,
		PowerIndicator,
		FlashingIndicator,
		PowerCarrier,
		PowerCarrierWall,
		Teleporter,
		Turf,
		PowerTurf,
		HomeSpace,
		LockedWall,
		DirectionalWall,
		ToggleableWall,
		ItemBox,
	},
};