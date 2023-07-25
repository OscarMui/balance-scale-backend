# balance-scale-backend 

The backend of a game based on Alice in Borderland, a TV show on Netflix. 

## Technology

Written in TypeScript using the ExpressJS framework. It heavily makes use of  for easy bidirectional communication with the clients. 

## Installation

Requires Node.js and npm

```bash
npm install
```

or

```bash
yarn
```

## Usage

```bash
npm run start
```

or

```bash
yarn start
```

## Game Rules

*Copied from [Alice in Borderland Fandom](https://aliceinborderland.fandom.com/wiki/King_of_Diamonds_(Netflix)) 

### Rules

Player limit: 5

Time limit: 3 minutes per round (no round limit)

All players start with 0 points.

Each player has a tablet in front of them containing a number grid with numbers 0 to 100.

In each round, the player must select a number from the grid.

Once all numbers are selected, the average will be calculated, then multiplied by 0.8.
The player closest to the number wins the round. The other players each lose a point. 

If a player reaches -10 points, it is a GAME OVER for that player.

A new rule will be introduced for every player eliminated.

4 players remaining: If two or more players choose the same number, the number is invalid and all players who selected the number will lose a point.

3 players remaining: If a player chooses the exact correct number, they win the round and all other players lose two points.

2 players remaining: If someone chooses 0, a player who chooses 100 automatically wins the round.

It is GAME CLEAR for the last remaining player.