export function stepPlayer(position, direction, queuedDirection, isWall) {
  const hasQueuedDirection = queuedDirection.x !== 0 || queuedDirection.y !== 0;
  const queuedIsOpen = hasQueuedDirection
    && !isWall(position.x + queuedDirection.x, position.y + queuedDirection.y);
  const nextDirection = queuedIsOpen ? queuedDirection : direction;
  const nextPosition = {
    x: position.x + nextDirection.x,
    y: position.y + nextDirection.y,
  };

  return {
    position: isWall(nextPosition.x, nextPosition.y) ? { ...position } : nextPosition,
    direction: { ...nextDirection },
  };
}