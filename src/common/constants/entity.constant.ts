export const ENTITY_TIMESTAMPS = [
  {
    name: 'created_at',
    type: 'bigint',
    isNullable: true,
    default: Math.floor(Date.now() / 1000),
  },
  {
    name: 'created_by',
    type: 'varchar',
    isNullable: true,
  },
  {
    name: 'created_by_id',
    type: 'uuid',
    isNullable: true,
  },
  {
    name: 'updated_at',
    type: 'bigint',
    isNullable: true,
    default: Math.floor(Date.now() / 1000),
  },
  {
    name: 'updated_by',
    type: 'varchar',
    isNullable: true,
  },
  {
    name: 'updated_by_id',
    type: 'uuid',
    isNullable: true,
  },
  {
    name: 'deleted_at',
    type: 'bigint',
    isNullable: true,
  },
  {
    name: 'deleted_by',
    type: 'varchar',
    isNullable: true,
  },
  {
    name: 'deleted_by_id',
    type: 'uuid',
    isNullable: true,
  },
];
