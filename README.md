Squeal
------

SQL is broken. It's verbose and unintuitive to the modern-day programmer.

Filtering by the total value of an accounting transaction
=========================================================

### In Javascript:

```js
JournalEntry.find(
  (journalEntry) => _.sumBy(journalEntry.lineItems,
                            (lineItem) => lineItem.debit) > 10000
)
```

### Doing the same in SQL
```sql
SELECT
  *
FROM JournalEntries
WHERE (SELECT SUM(debit)
        FROM LineItems
        WHERE LineItems.JournalEntryId = JournalEntries.ID) > 10000
```

### Doing the same in Sequelize.js
Impossible

### Doing the same in Knex
Not very different from doing it in SQL

### How Squeal tries to solve it
```js
JournalEntry.where(
  (journalEntry) => journalEntry.fetch('lineItems').col('debit').sum() > 1000
)
```

## TODO:
1. Clean up API
2. Test cases
3. Optimizations using `WITH` clauses
