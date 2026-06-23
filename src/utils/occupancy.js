export function isDealActive(deal) {
    if (!deal) return false;
    return deal.occupancyStatus !== "Left";
}

export function getActiveDealForProperty(propertyId, deals = []) {
    return deals.find(
        (deal) => deal.propertyId === propertyId && isDealActive(deal)
    );
}

export function isPropertyOccupied(propertyId, deals = []) {
    return Boolean(getActiveDealForProperty(propertyId, deals));
}

export function canTenantBrowseProperty(propertyId, tenantId, deals = []) {
    const activeDeal = getActiveDealForProperty(propertyId, deals);
    if (!activeDeal) return true;
    return activeDeal.tenantId === tenantId;
}

export function filterBrowsableProperties(properties, tenantId, deals = []) {
    return properties.filter((property) =>
        canTenantBrowseProperty(property.id, tenantId, deals)
    );
}
