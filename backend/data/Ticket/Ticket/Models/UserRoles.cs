namespace Ticket.Models;

public static class UserRoles
{
    public const string Admin = "Admin";
    public const string Employee = "Employee";
    public const string Client = "Client";

    public static bool CanManageEmployees(string role)
    {
        return role == Admin;
    }

    public static bool CanManageEvents(string role)
    {
        return role == Admin || role == Employee;
    }

    public static bool CanSellSeats(string role)
    {
        return role == Employee;
    }

    public static bool CanReserveOrBuy(string role)
    {
        return role == Client;
    }
}
