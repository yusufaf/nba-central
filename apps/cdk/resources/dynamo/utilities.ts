type DynamoItem = {
    PK?: string;
    SK?: string;
    PK2?: string;
    SK2?: string;
    PK3?: string;
    SK3?: string;
    PK4?: string;
    SK4?: string; 
    PK5?: string;
    SK5?: string;
    PK6?: string;
    SK6?: string; 
}
export const removeKeys = (item: DynamoItem) => {
    delete item.PK;
    delete item.SK;
    delete item.PK2;
    delete item.SK2;
    delete item.PK3;
    delete item.SK3;
    delete item.PK4;
    delete item.SK4;
    delete item.PK5;
    delete item.SK5;
    delete item.PK6;
    delete item.SK6;
}