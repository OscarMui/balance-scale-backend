# balance-scale-backend 

The backend of a game based on Alice in Borderland, a TV show on Netflix. 

## Technology

Written in TypeScript using the ExpressJS framework. It heavily makes use of  for easy bidirectional communication with the clients. 

## Installation

Requires Node.js, npm, and tsc. (Install tsc by `npm install -g typescript`)

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

Every player chooses a number between 0 and 100 in each round. The player closest to the target wins the round. The target would be the average of the numbers multiplied by 0.8. 

All players start with 0 points. If a player reaches -5 points, it is a GAME OVER for that player. The last person standing wins. 

A new rule will be introduced for every player eliminated.

### The new rules upon elimination

4 players remaining: If two or more players choose the same number, the number is invalid and all players who selected the number will lose a point.

3 players remaining: If a player chooses the exact correct number, they win the round and all other players lose two points.

2 players remaining: If someone chooses 0, a player who chooses 100 wins the round.

### FAQs

Q: I am confused after reading the rules.

A: You are not alone! The key to the game is that 0.8 multiplier. With that, it means that the target will never be above 80, as the average is at most 100. Then people should never choose a number above 80 to win. But if everyone thinks the same, they should not choose a number above 64, as the average will not go beyond 80. This creates a dilemma that leads to people choosing smaller and smaller numbers.

Q: I watched Alice in Borderland, are there any differences between your game and the game in the TV show?

A: Not much except for a few technicalities, and the fact that you don't die if you lose. This game is designed to recreate the game in Alice in Borderland, so that viewers can try it out for themselves. 

Here are the differences:

1. The round time is shortened to 2 minutes. 

2. The GAME OVER score is changed to -5.

3. Players can disconnect anytime, it counts as a GAME OVER for that player.

4. Players need to type in the number digit by digit.

The changes are mainly to address the fast lifestyle of people outside of the Borderland, and the fact that your screen is smaller than the one the TV show uses.

Q: Am I allowed to communicate?

A: Absolutely. That's what makes the game interesting. It is a shame that I do not have time to add communication features in-game. You are encouraged to communicate with your opponents during the game using other means.

Q: How do computer players behave?

A: Computer players will fill the game if there are no new joiners for 15 seconds. Or else I think there will never be a successful game being held. 

For the math nerds, they will choose a number at random (uniformly) between 0 and 100*0.8^(round-1). 

In other words, they would choose a number between 0 and 100 in the first round, then between 0 and 80, then between 0 and 64. I hope you get the idea.

When there are two players left the computer player would choose a number among 0, 1, and 100. 